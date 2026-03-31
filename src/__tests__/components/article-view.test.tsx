import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { ArticleView } from "@/components/reader/article-view";
import { keyboardEvents } from "@/lib/keyboard-shortcuts";
import { usePlatformStore } from "@/stores/platform-store";
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
    usePlatformStore.setState(usePlatformStore.getInitialState());
    usePlatformStore.setState({
      platform: {
        kind: "windows",
        capabilities: {
          supports_reading_list: false,
          supports_background_browser_open: false,
          supports_runtime_window_icon_replacement: true,
          supports_native_browser_navigation: true,
          uses_dev_file_credentials: false,
        },
      },
      loaded: true,
      loadError: false,
      inFlightLoad: null,
    });
    setupTauriMocks((cmd, args) => {
      switch (cmd) {
        case "list_articles":
          return sampleArticles.filter((article) => article.feed_id === args.feedId);
        case "list_account_articles":
          return sampleArticles.filter((article) =>
            sampleFeeds.some((feed) => feed.id === article.feed_id && feed.account_id === args.accountId),
          );
        case "list_feeds":
          return sampleFeeds.filter((feed) => feed.account_id === args.accountId);
        case "list_tags":
          return [
            { id: "tag-1", name: "Later", color: null },
            { id: "tag-2", name: "Important", color: "#ff0000" },
          ];
        case "get_article_tags":
          return [{ id: "tag-1", name: "Later", color: null }];
        case "create_or_update_browser_webview":
          return {
            url: args.url,
            can_go_back: false,
            can_go_forward: false,
            is_loading: true,
          };
        case "update_feed_display_mode":
          return null;
        default:
          return undefined;
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

  it("opens the in-app browser from the article title when open_links is in_app", async () => {
    useUiStore.getState().selectAccount("acc-1");
    useUiStore.getState().selectFeed("feed-1");
    useUiStore.getState().selectArticle("art-1");
    usePreferencesStore.setState({ prefs: { open_links: "in_app" }, loaded: true });

    const user = userEvent.setup();
    render(<ArticleView />, { wrapper: createWrapper() });

    await user.click(await screen.findByRole("button", { name: "First Article" }));

    await waitFor(() => {
      expect(useUiStore.getState().contentMode).toBe("browser");
      expect(useUiStore.getState().browserUrl).toBe("https://example.com/1");
    });
  });

  it("opens the external browser from the article title when open_links is default_browser", async () => {
    const calls: MockCall[] = [];
    setupTauriMocks((cmd, args) => {
      calls.push({ cmd, args });

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
        case "open_in_browser":
          return null;
        default:
          return undefined;
      }
    });

    useUiStore.getState().selectAccount("acc-1");
    useUiStore.getState().selectFeed("feed-1");
    useUiStore.getState().selectArticle("art-1");
    usePreferencesStore.setState({ prefs: { open_links: "default_browser" }, loaded: true });

    const user = userEvent.setup();
    render(<ArticleView />, { wrapper: createWrapper() });

    calls.length = 0;

    await user.click(await screen.findByRole("button", { name: "First Article" }));

    await waitFor(() => {
      expect(calls).toContainEqual({
        cmd: "open_in_browser",
        args: { url: "https://example.com/1", background: false },
      });
    });

    expect(useUiStore.getState().contentMode).toBe("reader");
    expect(useUiStore.getState().browserUrl).toBeNull();
  });

  it("keeps feed navigation separate after opening the article title in-app browser", async () => {
    useUiStore.getState().selectAccount("acc-1");
    useUiStore.getState().selectFeed("feed-1");
    useUiStore.getState().selectArticle("art-1");
    usePreferencesStore.setState({ prefs: { open_links: "in_app" }, loaded: true });

    const user = userEvent.setup();
    render(<ArticleView />, { wrapper: createWrapper() });

    await user.click(await screen.findByRole("button", { name: "First Article" }));

    await waitFor(() => {
      expect(useUiStore.getState().contentMode).toBe("browser");
      expect(useUiStore.getState().browserUrl).toBe("https://example.com/1");
    });

    expect(screen.getByRole("heading", { level: 1, name: "First Article" })).toBeInTheDocument();
    expect(screen.getByText("Browser View")).toBeInTheDocument();

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

  it("opens the external browser from the toolbar button", async () => {
    const calls: MockCall[] = [];
    setupTauriMocks((cmd, args) => {
      calls.push({ cmd, args });

      switch (cmd) {
        case "list_articles":
          return sampleArticles.filter((article) => article.feed_id === args.feedId);
        case "list_account_articles":
          return sampleArticles.filter((article) =>
            sampleFeeds.some((feed) => feed.id === article.feed_id && feed.account_id === args.accountId),
          );
        case "list_feeds":
          return sampleFeeds.filter((feed) => feed.account_id === args.accountId);
        case "list_tags":
          return [
            { id: "tag-1", name: "Later", color: null },
            { id: "tag-2", name: "Important", color: "#ff0000" },
          ];
        case "get_article_tags":
          return [{ id: "tag-1", name: "Later", color: null }];
        case "open_in_browser":
        case "update_feed_display_mode":
          return null;
        default:
          return undefined;
      }
    });

    useUiStore.getState().selectAccount("acc-1");
    useUiStore.getState().selectFeed("feed-1");
    useUiStore.getState().selectArticle("art-1");

    const user = userEvent.setup();
    render(<ArticleView />, { wrapper: createWrapper() });

    calls.length = 0;

    await user.click(await screen.findByRole("button", { name: "Open in external browser" }));

    await waitFor(() => {
      expect(calls).toContainEqual({
        cmd: "open_in_browser",
        args: { url: "https://example.com/1", background: false },
      });
    });
  });

  it("shows a toast when opening the external browser from the toolbar fails", async () => {
    setupTauriMocks((cmd, args) => {
      switch (cmd) {
        case "list_articles":
          return sampleArticles.filter((article) => article.feed_id === args.feedId);
        case "list_account_articles":
          return sampleArticles.filter((article) =>
            sampleFeeds.some((feed) => feed.id === article.feed_id && feed.account_id === args.accountId),
          );
        case "list_feeds":
          return sampleFeeds.filter((feed) => feed.account_id === args.accountId);
        case "list_tags":
          return [
            { id: "tag-1", name: "Later", color: null },
            { id: "tag-2", name: "Important", color: "#ff0000" },
          ];
        case "get_article_tags":
          return [{ id: "tag-1", name: "Later", color: null }];
        case "open_in_browser":
          throw { type: "UserVisible", message: "Could not launch browser" };
        case "update_feed_display_mode":
          return null;
        default:
          return undefined;
      }
    });

    useUiStore.getState().selectAccount("acc-1");
    useUiStore.getState().selectFeed("feed-1");
    useUiStore.getState().selectArticle("art-1");

    const user = userEvent.setup();
    render(<ArticleView />, { wrapper: createWrapper() });

    await user.click(await screen.findByRole("button", { name: "Open in external browser" }));

    await waitFor(() => {
      expect(useUiStore.getState().toastMessage).toEqual({ message: "Could not launch browser" });
    });
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
          return undefined;
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
          return undefined;
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

  it("keeps explicit 3-pane feeds in reader mode even when the global default is widescreen", async () => {
    setupTauriMocks((cmd, args) => {
      switch (cmd) {
        case "list_articles":
          return sampleArticles.filter((article) => article.feed_id === args.feedId);
        case "list_feeds":
          return sampleFeeds
            .filter((feed) => feed.account_id === args.accountId)
            .map((feed) => (feed.id === "feed-1" ? { ...feed, display_mode: "normal" } : feed));
        case "list_tags":
          return [];
        case "get_article_tags":
          return [];
        default:
          return undefined;
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
      prefs: { reader_view: "widescreen" },
      loaded: true,
    });

    render(<ArticleView />, { wrapper: createWrapper() });

    await screen.findByRole("heading", { level: 1, name: "First Article" });

    expect(useUiStore.getState().contentMode).toBe("reader");
    expect(useUiStore.getState().browserUrl).toBeNull();
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
          return undefined;
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

  it("hides reading list action when platform does not support it", async () => {
    useUiStore.getState().selectAccount("acc-1");
    useUiStore.getState().selectFeed("feed-1");
    useUiStore.getState().selectArticle("art-1");

    const user = userEvent.setup();
    render(<ArticleView />, { wrapper: createWrapper() });

    await user.click(await screen.findByRole("button", { name: "Share" }));
    await screen.findByText("Copy link");

    expect(screen.queryByText("Add to Reading List")).not.toBeInTheDocument();
  });

  it("shows reading list action when platform supports it", async () => {
    usePlatformStore.setState({
      platform: {
        kind: "macos",
        capabilities: {
          supports_reading_list: true,
          supports_background_browser_open: false,
          supports_runtime_window_icon_replacement: true,
          supports_native_browser_navigation: true,
          uses_dev_file_credentials: false,
        },
      },
      loaded: true,
      loadError: false,
      inFlightLoad: null,
    });
    useUiStore.getState().selectAccount("acc-1");
    useUiStore.getState().selectFeed("feed-1");
    useUiStore.getState().selectArticle("art-1");

    const user = userEvent.setup();
    render(<ArticleView />, { wrapper: createWrapper() });

    await user.click(await screen.findByRole("button", { name: "Share" }));

    expect(await screen.findByText("Add to Reading List")).toBeInTheDocument();
  });

  it("does not invoke add to reading list from keyboard shortcut when unsupported", async () => {
    const calls: MockCall[] = [];
    setupTauriMocks((cmd, args) => {
      calls.push({ cmd, args });

      switch (cmd) {
        case "list_articles":
          return sampleArticles.filter((article) => article.feed_id === args.feedId);
        case "list_account_articles":
          return sampleArticles.filter((article) =>
            sampleFeeds.some((feed) => feed.id === article.feed_id && feed.account_id === args.accountId),
          );
        case "list_feeds":
          return sampleFeeds.filter((feed) => feed.account_id === args.accountId);
        case "list_tags":
          return [
            { id: "tag-1", name: "Later", color: null },
            { id: "tag-2", name: "Important", color: "#ff0000" },
          ];
        case "get_article_tags":
          return [{ id: "tag-1", name: "Later", color: null }];
        case "add_to_reading_list":
        case "update_feed_display_mode":
          return null;
        default:
          return undefined;
      }
    });

    useUiStore.getState().selectAccount("acc-1");
    useUiStore.getState().selectFeed("feed-1");
    useUiStore.getState().selectArticle("art-1");

    render(<ArticleView />, { wrapper: createWrapper() });

    await screen.findByRole("heading", { level: 1, name: "First Article" });

    calls.length = 0;
    window.dispatchEvent(new Event(keyboardEvents.addToReadingList));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(calls).not.toContainEqual({
      cmd: "add_to_reading_list",
      args: { url: "https://example.com/1" },
    });
  });

  it("invokes add to reading list from keyboard shortcut when supported", async () => {
    const calls: MockCall[] = [];
    setupTauriMocks((cmd, args) => {
      calls.push({ cmd, args });

      switch (cmd) {
        case "list_articles":
          return sampleArticles.filter((article) => article.feed_id === args.feedId);
        case "list_account_articles":
          return sampleArticles.filter((article) =>
            sampleFeeds.some((feed) => feed.id === article.feed_id && feed.account_id === args.accountId),
          );
        case "list_feeds":
          return sampleFeeds.filter((feed) => feed.account_id === args.accountId);
        case "list_tags":
          return [
            { id: "tag-1", name: "Later", color: null },
            { id: "tag-2", name: "Important", color: "#ff0000" },
          ];
        case "get_article_tags":
          return [{ id: "tag-1", name: "Later", color: null }];
        case "add_to_reading_list":
        case "update_feed_display_mode":
          return null;
        default:
          return undefined;
      }
    });
    usePlatformStore.setState({
      platform: {
        kind: "macos",
        capabilities: {
          supports_reading_list: true,
          supports_background_browser_open: false,
          supports_runtime_window_icon_replacement: true,
          supports_native_browser_navigation: true,
          uses_dev_file_credentials: false,
        },
      },
      loaded: true,
      loadError: false,
      inFlightLoad: null,
    });
    useUiStore.getState().selectAccount("acc-1");
    useUiStore.getState().selectFeed("feed-1");
    useUiStore.getState().selectArticle("art-1");

    render(<ArticleView />, { wrapper: createWrapper() });

    await screen.findByRole("heading", { level: 1, name: "First Article" });

    calls.length = 0;
    window.dispatchEvent(new Event(keyboardEvents.addToReadingList));

    await waitFor(() => {
      expect(calls).toContainEqual({
        cmd: "add_to_reading_list",
        args: { url: "https://example.com/1" },
      });
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
