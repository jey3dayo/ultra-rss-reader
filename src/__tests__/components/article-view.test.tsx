import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { ArticleView } from "@/components/reader/article-view";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";
import { createWrapper } from "../../../tests/helpers/create-wrapper";
import { sampleArticles, sampleFeeds, setupTauriMocks } from "../../../tests/helpers/tauri-mocks";

type MockCall = {
  cmd: string;
  args: Record<string, unknown>;
};

describe("ArticleView", () => {
  beforeEach(() => {
    useUiStore.setState(useUiStore.getInitialState());
    usePreferencesStore.setState({ prefs: {}, loaded: false });
    setupTauriMocks((cmd, args) => {
      switch (cmd) {
        case "list_articles":
          return sampleArticles.filter((article) => article.feed_id === args.feedId);
        case "list_feeds":
          return sampleFeeds.filter((feed) => feed.account_id === args.accountId);
        case "list_tags":
          return [
            { id: "tag-1", name: "Later", color: null },
            { id: "tag-2", name: "Important", color: "#ff0000" },
          ];
        case "get_article_tags":
          return [{ id: "tag-1", name: "Later", color: null }];
        case "update_feed_display_mode":
          return null;
        default:
          return null;
      }
    });
  });

  it("uses the close button to return to the list in compact layout", async () => {
    useUiStore.getState().selectAccount("acc-1");
    useUiStore.getState().selectFeed("feed-1");
    useUiStore.getState().selectArticle("art-1");
    useUiStore.setState({ layoutMode: "compact", focusedPane: "content" });

    const user = userEvent.setup();
    render(<ArticleView />, { wrapper: createWrapper() });

    const button = await screen.findByRole("button", { name: "Close view" });
    await user.click(button);

    await waitFor(() => {
      expect(useUiStore.getState().focusedPane).toBe("list");
      expect(useUiStore.getState().contentMode).toBe("empty");
    });
  });

  it("opens the browser from the article title and keeps feed navigation separate", async () => {
    useUiStore.getState().selectAccount("acc-1");
    useUiStore.getState().selectFeed("feed-1");
    useUiStore.getState().selectArticle("art-1");

    const user = userEvent.setup();
    render(<ArticleView />, { wrapper: createWrapper() });

    await user.click(await screen.findByRole("button", { name: "First Article" }));

    await waitFor(() => {
      expect(useUiStore.getState().contentMode).toBe("browser");
      expect(useUiStore.getState().browserUrl).toBe("https://example.com/1");
    });

    useUiStore.getState().closeBrowser();

    const feedButton = await screen.findByRole("button", { name: "Tech Blog" });
    await user.click(feedButton);

    await waitFor(() => {
      expect(useUiStore.getState().selection).toEqual({ type: "feed", feedId: "feed-1" });
      expect(useUiStore.getState().contentMode).toBe("empty");
    });
  });

  it("shows tooltips for icon-only article toolbar actions", async () => {
    useUiStore.getState().selectAccount("acc-1");
    useUiStore.getState().selectFeed("feed-1");
    useUiStore.getState().selectArticle("art-1");

    const user = userEvent.setup();
    render(<ArticleView />, { wrapper: createWrapper() });

    await user.hover(await screen.findByRole("button", { name: "Copy link" }));

    expect(await screen.findByText("Copy link")).toBeInTheDocument();
  });

  it("uses the close button as UI navigation back from the reader", async () => {
    useUiStore.getState().selectAccount("acc-1");
    useUiStore.getState().selectFeed("feed-1");
    useUiStore.getState().selectArticle("art-1");

    const user = userEvent.setup();
    render(<ArticleView />, { wrapper: createWrapper() });

    await user.click(await screen.findByRole("button", { name: "Close view" }));

    await waitFor(() => {
      expect(useUiStore.getState().contentMode).toBe("empty");
      expect(useUiStore.getState().selectedArticleId).toBeNull();
    });
  });

  it("does not auto-mark the article as read when after_reading is do_nothing", async () => {
    const calls: MockCall[] = [];
    setupTauriMocks((cmd, args) => {
      calls.push({ cmd, args });

      switch (cmd) {
        case "list_articles":
          return sampleArticles.filter((article) => article.feed_id === args.feedId);
        case "list_feeds":
          return sampleFeeds.filter((feed) => feed.account_id === args.accountId);
        case "list_tags":
          return [];
        case "get_article_tags":
          return [];
        default:
          return null;
      }
    });

    useUiStore.setState({
      ...useUiStore.getInitialState(),
      selectedAccountId: "acc-1",
      selection: { type: "feed", feedId: "feed-1" },
      selectedArticleId: "art-1",
      contentMode: "reader",
    });
    usePreferencesStore.setState({
      prefs: { after_reading: "do_nothing" },
      loaded: true,
    });

    render(<ArticleView />, { wrapper: createWrapper() });

    await screen.findByRole("heading", { level: 1, name: "First Article" });

    expect(calls).not.toContainEqual({
      cmd: "mark_article_read",
      args: { articleId: "art-1", read: true },
    });
  });

  it("auto-opens widescreen feeds even from all-items selection", async () => {
    setupTauriMocks((cmd, args) => {
      switch (cmd) {
        case "list_account_articles":
          return sampleArticles;
        case "list_feeds":
          return sampleFeeds
            .filter((feed) => feed.account_id === args.accountId)
            .map((feed) => (feed.id === "feed-1" ? { ...feed, display_mode: "widescreen" } : feed));
        case "list_tags":
          return [];
        case "get_article_tags":
          return [];
        default:
          return null;
      }
    });

    useUiStore.setState({
      ...useUiStore.getInitialState(),
      selectedAccountId: "acc-1",
      selection: { type: "all" },
      selectedArticleId: "art-1",
      contentMode: "reader",
    });
    usePreferencesStore.setState({
      prefs: { reader_view: "off" },
      loaded: true,
    });

    render(<ArticleView />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(useUiStore.getState().contentMode).toBe("browser");
      expect(useUiStore.getState().browserUrl).toBe("https://example.com/1");
    });
  });

  it("retries auto-open after account articles finish loading", async () => {
    let resolveAccountArticles: ((articles: typeof sampleArticles) => void) | undefined;

    setupTauriMocks((cmd, args) => {
      switch (cmd) {
        case "list_account_articles":
          return new Promise<typeof sampleArticles>((resolve) => {
            resolveAccountArticles = resolve;
          });
        case "list_feeds":
          return sampleFeeds.filter((feed) => feed.account_id === args.accountId);
        case "list_tags":
          return [];
        case "get_article_tags":
          return [];
        default:
          return null;
      }
    });

    useUiStore.setState({
      ...useUiStore.getInitialState(),
      selectedAccountId: "acc-1",
      selection: { type: "all" },
      selectedArticleId: "art-1",
      contentMode: "reader",
    });
    usePreferencesStore.setState({
      prefs: { reader_view: "on" },
      loaded: true,
    });

    render(<ArticleView />, { wrapper: createWrapper() });

    await screen.findByText("Article not found");
    const resolveLoadedArticles = resolveAccountArticles;
    if (!resolveLoadedArticles) {
      throw new Error("account articles resolver was not set");
    }

    resolveLoadedArticles(sampleArticles);

    await waitFor(() => {
      expect(useUiStore.getState().contentMode).toBe("browser");
      expect(useUiStore.getState().browserUrl).toBe("https://example.com/1");
    });
  });

  it("renders the share menu button when an article is selected", async () => {
    useUiStore.getState().selectAccount("acc-1");
    useUiStore.getState().selectFeed("feed-1");
    useUiStore.getState().selectArticle("art-1");

    render(<ArticleView />, { wrapper: createWrapper() });

    const shareButton = await screen.findByRole("button", { name: "Share" });
    expect(shareButton).toBeInTheDocument();
    expect(shareButton).toBeEnabled();
  });

  it("disables the share menu button when no article is selected", async () => {
    useUiStore.getState().selectAccount("acc-1");
    useUiStore.getState().selectFeed("feed-1");

    render(<ArticleView />, { wrapper: createWrapper() });

    await waitFor(() => {
      const shareButton = screen.getByRole("button", { name: "Share" });
      expect(shareButton).toBeDisabled();
    });
  });

  it("hides the share menu button when action_share_menu preference is false", async () => {
    usePreferencesStore.setState({ prefs: { action_share_menu: "false" }, loaded: true });
    useUiStore.getState().selectAccount("acc-1");
    useUiStore.getState().selectFeed("feed-1");
    useUiStore.getState().selectArticle("art-1");

    render(<ArticleView />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Share" })).not.toBeInTheDocument();
    });
  });
});
