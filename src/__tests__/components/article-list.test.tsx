import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppConfirmDialog } from "@/components/app-confirm-dialog";
import { ArticleList } from "@/components/reader/article-list";
import { ArticleView } from "@/components/reader/article-view";
import { APP_EVENTS } from "@/constants/events";
import * as articleHooks from "@/hooks/use-articles";
import * as tagHooks from "@/hooks/use-tags";
import { keyboardEvents } from "@/lib/keyboard-shortcuts";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";
import { createWrapper } from "../../../tests/helpers/create-wrapper";
import { sampleArticles, sampleFeeds, setupTauriMocks } from "../../../tests/helpers/tauri-mocks";

describe("ArticleList", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    useUiStore.setState(useUiStore.getInitialState());
    usePreferencesStore.setState({ prefs: {}, loaded: false });
    setupTauriMocks((cmd, args) => {
      switch (cmd) {
        case "list_feeds":
          return sampleFeeds.filter((feed) => feed.account_id === args.accountId);
        case "list_articles":
          return sampleArticles.filter((article) => article.feed_id === args.feedId);
        case "list_account_articles":
          return sampleArticles.filter((article) =>
            sampleFeeds.some((feed) => feed.id === article.feed_id && feed.account_id === args.accountId),
          );
        case "list_articles_by_tag":
          return [sampleArticles[0]];
        case "search_articles":
          return [];
        default:
          return null;
      }
    });
  });

  it.each([
    {
      label: "feed",
      selection: { type: "feed", feedId: "feed-1" } as const,
      initialArticle: { ...sampleArticles[0], id: "feed-snapshot", title: "Feed Snapshot Article" },
    },
    {
      label: "all",
      selection: { type: "all" } as const,
      initialArticle: { ...sampleArticles[0], id: "all-snapshot", title: "All Snapshot Article" },
    },
    {
      label: "tag",
      selection: { type: "tag", tagId: "tag-1" } as const,
      initialArticle: { ...sampleArticles[0], id: "tag-snapshot", title: "Tag Snapshot Article" },
    },
  ])("keeps the $label list visible while the primary source revalidates", async ({
    label,
    selection,
    initialArticle,
  }) => {
    const articlesSpy = vi.spyOn(articleHooks, "useArticles");
    const accountArticlesSpy = vi.spyOn(articleHooks, "useAccountArticles");
    const tagArticlesSpy = vi.spyOn(tagHooks, "useArticlesByTag");

    articlesSpy.mockReturnValue({ data: undefined, isLoading: false } as ReturnType<typeof articleHooks.useArticles>);
    accountArticlesSpy.mockReturnValue({ data: undefined, isLoading: false } as ReturnType<
      typeof articleHooks.useAccountArticles
    >);
    tagArticlesSpy.mockReturnValue({ data: undefined, isLoading: false } as ReturnType<
      typeof tagHooks.useArticlesByTag
    >);

    if (label === "feed") {
      articlesSpy.mockReturnValue({
        data: [initialArticle],
        isLoading: false,
      } as ReturnType<typeof articleHooks.useArticles>);
    } else if (label === "all") {
      accountArticlesSpy.mockReturnValue({
        data: [initialArticle],
        isLoading: false,
      } as ReturnType<typeof articleHooks.useAccountArticles>);
    } else {
      tagArticlesSpy.mockReturnValue({
        data: [initialArticle],
        isLoading: false,
      } as ReturnType<typeof tagHooks.useArticlesByTag>);
    }

    useUiStore.setState({
      ...useUiStore.getInitialState(),
      selectedAccountId: "acc-1",
      selection,
      viewMode: "all",
    });

    const { rerender } = render(<ArticleList />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText(initialArticle.title)).toBeInTheDocument();
    });

    if (label === "feed") {
      articlesSpy.mockReturnValue({
        data: undefined,
        isLoading: true,
      } as ReturnType<typeof articleHooks.useArticles>);
    } else if (label === "all") {
      accountArticlesSpy.mockReturnValue({
        data: undefined,
        isLoading: true,
      } as ReturnType<typeof articleHooks.useAccountArticles>);
    } else {
      tagArticlesSpy.mockReturnValue({
        data: undefined,
        isLoading: true,
      } as ReturnType<typeof tagHooks.useArticlesByTag>);
    }

    rerender(<ArticleList />);

    await waitFor(() => {
      expect(screen.getByText(initialArticle.title)).toBeInTheDocument();
    });
  });

  it("does not reuse a feed snapshot after switching to the all-articles context", async () => {
    const articlesSpy = vi.spyOn(articleHooks, "useArticles");
    const accountArticlesSpy = vi.spyOn(articleHooks, "useAccountArticles");
    const tagArticlesSpy = vi.spyOn(tagHooks, "useArticlesByTag");

    articlesSpy.mockReturnValue({ data: undefined, isLoading: false } as ReturnType<typeof articleHooks.useArticles>);
    accountArticlesSpy.mockReturnValue({ data: undefined, isLoading: false } as ReturnType<
      typeof articleHooks.useAccountArticles
    >);
    tagArticlesSpy.mockReturnValue({ data: undefined, isLoading: false } as ReturnType<
      typeof tagHooks.useArticlesByTag
    >);

    articlesSpy.mockImplementation((feedId) => {
      if (feedId === "feed-1") {
        return {
          data: [{ ...sampleArticles[0], id: "feed-1-snapshot", title: "Feed 1 Snapshot Article" }],
          isLoading: false,
        } as ReturnType<typeof articleHooks.useArticles>;
      }

      return {
        data: undefined,
        isLoading: false,
      } as ReturnType<typeof articleHooks.useArticles>;
    });
    accountArticlesSpy.mockImplementation((accountId) => {
      if (accountId === "acc-1" && useUiStore.getState().selection.type === "all") {
        return {
          data: undefined,
          isLoading: true,
        } as ReturnType<typeof articleHooks.useAccountArticles>;
      }

      return {
        data: undefined,
        isLoading: false,
      } as ReturnType<typeof articleHooks.useAccountArticles>;
    });

    useUiStore.getState().selectAccount("acc-1");
    useUiStore.getState().selectFeed("feed-1");

    const { rerender } = render(<ArticleList />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText("Feed 1 Snapshot Article")).toBeInTheDocument();
    });

    useUiStore.getState().selectAll();
    rerender(<ArticleList />);

    await waitFor(() => {
      expect(screen.queryByText("Feed 1 Snapshot Article")).not.toBeInTheDocument();
    });
  });

  it("renders tagged articles in the list", async () => {
    useUiStore.getState().selectAccount("acc-1");
    useUiStore.getState().selectTag("tag-1");

    render(<ArticleList />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText(sampleArticles[0].title)).toBeInTheDocument();
    });
  });

  it("renders only articles from the selected folder", async () => {
    useUiStore.setState({
      ...useUiStore.getInitialState(),
      selectedAccountId: "acc-1",
      selection: { type: "folder", folderId: "folder-tech" },
      viewMode: "all",
    });

    setupTauriMocks((cmd, args) => {
      switch (cmd) {
        case "list_feeds":
          return [
            { ...sampleFeeds[0], id: "feed-tech", folder_id: "folder-tech", account_id: args.accountId },
            { ...sampleFeeds[1], id: "feed-news", folder_id: "folder-news", account_id: args.accountId },
          ];
        case "list_account_articles":
          return [
            { ...sampleArticles[0], id: "art-tech", title: "Tech Article", feed_id: "feed-tech" },
            { ...sampleArticles[1], id: "art-news", title: "News Article", feed_id: "feed-news" },
          ];
        case "list_articles":
          return [];
        case "list_articles_by_tag":
          return [];
        case "search_articles":
          return [];
        default:
          return null;
      }
    });

    render(<ArticleList />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText("Tech Article")).toBeInTheDocument();
      expect(screen.queryByText("News Article")).not.toBeInTheDocument();
    });
  });

  it("keeps folder scope when showing search results", async () => {
    useUiStore.setState({
      ...useUiStore.getInitialState(),
      selectedAccountId: "acc-1",
      selection: { type: "folder", folderId: "folder-tech" },
      viewMode: "all",
    });

    setupTauriMocks((cmd, args) => {
      switch (cmd) {
        case "list_feeds":
          return [
            { ...sampleFeeds[0], id: "feed-tech", folder_id: "folder-tech", account_id: args.accountId },
            { ...sampleFeeds[1], id: "feed-news", folder_id: "folder-news", account_id: args.accountId },
          ];
        case "list_account_articles":
          return [];
        case "list_articles":
          return [];
        case "list_articles_by_tag":
          return [];
        case "search_articles":
          return [
            { ...sampleArticles[0], id: "art-tech", title: "Tech Article", feed_id: "feed-tech" },
            { ...sampleArticles[1], id: "art-news", title: "News Article", feed_id: "feed-news" },
          ];
        default:
          return null;
      }
    });

    const user = userEvent.setup();
    render(<ArticleList />, { wrapper: createWrapper() });

    await user.click(await screen.findByRole("button", { name: "Search articles" }));
    await user.type(screen.getByRole("textbox", { name: "Search articles" }), "Article");

    await waitFor(() => {
      expect(screen.getByText("Tech Article")).toBeInTheDocument();
      expect(screen.queryByText("News Article")).not.toBeInTheDocument();
    });
  });

  it("keeps smart unread search results limited to unread articles", async () => {
    useUiStore.setState({
      ...useUiStore.getInitialState(),
      selectedAccountId: "acc-1",
      selection: { type: "smart", kind: "unread" },
      viewMode: "unread",
    });

    setupTauriMocks((cmd, args) => {
      switch (cmd) {
        case "list_feeds":
          return sampleFeeds.filter((feed) => feed.account_id === args.accountId);
        case "list_account_articles":
          return [];
        case "list_articles":
          return [];
        case "list_articles_by_tag":
          return [];
        case "search_articles":
          return [
            {
              ...sampleArticles[0],
              id: "smart-unread",
              title: "Smart Search Unread",
              is_read: false,
              is_starred: false,
            },
            { ...sampleArticles[1], id: "smart-read", title: "Smart Search Read", is_read: true, is_starred: true },
          ];
        default:
          return null;
      }
    });

    const user = userEvent.setup();
    render(<ArticleList />, { wrapper: createWrapper() });

    await user.click(await screen.findByRole("button", { name: "Search articles" }));
    await user.type(screen.getByRole("textbox", { name: "Search articles" }), "Smart");

    await waitFor(() => {
      expect(screen.getByText("Smart Search Unread")).toBeInTheDocument();
      expect(screen.queryByText("Smart Search Read")).not.toBeInTheDocument();
    });
  });

  it("keeps smart starred search results limited to starred articles while all mode shows both read and unread matches", async () => {
    useUiStore.setState({
      ...useUiStore.getInitialState(),
      selectedAccountId: "acc-1",
      selection: { type: "smart", kind: "starred" },
      viewMode: "all",
    });

    setupTauriMocks((cmd, args) => {
      switch (cmd) {
        case "list_feeds":
          return sampleFeeds.filter((feed) => feed.account_id === args.accountId);
        case "list_account_articles":
          return [];
        case "list_articles":
          return [];
        case "list_articles_by_tag":
          return [];
        case "search_articles":
          return [
            {
              ...sampleArticles[0],
              id: "smart-starred-unread",
              title: "Smart Search Starred Unread",
              is_read: false,
              is_starred: true,
            },
            {
              ...sampleArticles[1],
              id: "smart-starred-read",
              title: "Smart Search Starred Read",
              is_read: true,
              is_starred: true,
            },
            {
              ...sampleArticles[0],
              id: "smart-plain-unread",
              title: "Smart Search Plain Unread",
              is_read: false,
              is_starred: false,
            },
          ];
        default:
          return null;
      }
    });

    const user = userEvent.setup();
    render(<ArticleList />, { wrapper: createWrapper() });

    await user.click(await screen.findByRole("button", { name: "Search articles" }));
    await user.type(screen.getByRole("textbox", { name: "Search articles" }), "Smart");

    await waitFor(() => {
      expect(screen.getByText("Smart Search Starred Unread")).toBeInTheDocument();
      expect(screen.getByText("Smart Search Starred Read")).toBeInTheDocument();
      expect(screen.queryByText("Smart Search Plain Unread")).not.toBeInTheDocument();
    });
  });

  it("shows a search-specific empty state and lets the user clear the query", async () => {
    useUiStore.getState().selectAccount("acc-1");

    const user = userEvent.setup();
    render(<ArticleList />, { wrapper: createWrapper() });

    await user.click(await screen.findByRole("button", { name: "Search articles" }));
    await user.type(screen.getByRole("textbox", { name: "Search articles" }), "Nope");

    await waitFor(() => {
      expect(screen.getByText('No matches for "Nope"')).toBeInTheDocument();
      expect(screen.getByText("Try a different keyword or clear the current search.")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Clear search" })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Clear search" }));

    await waitFor(() => {
      expect(screen.queryByText('No matches for "Nope"')).not.toBeInTheDocument();
      expect(screen.getByText(sampleArticles[0].title)).toBeInTheDocument();
    });
  });

  it("keeps the current list visible until the debounced search actually starts", async () => {
    useUiStore.getState().selectAccount("acc-1");

    const user = userEvent.setup();
    render(<ArticleList />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText(sampleArticles[0].title)).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Search articles" }));
    await user.type(screen.getByRole("textbox", { name: "Search articles" }), "Nope");

    expect(screen.getByText(sampleArticles[0].title)).toBeInTheDocument();
    expect(screen.queryByText('No matches for "Nope"')).not.toBeInTheDocument();
  });

  it("lets mobile users navigate back to the sidebar", async () => {
    useUiStore.setState({ layoutMode: "mobile" });
    useUiStore.getState().selectAccount("acc-1");

    const user = userEvent.setup();
    render(<ArticleList />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText(sampleArticles[0].title)).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Show sidebar" }));

    expect(useUiStore.getState().focusedPane).toBe("sidebar");
  });

  it("shows a labeled compact sidebar affordance and navigates back to the sidebar", async () => {
    useUiStore.setState({ layoutMode: "compact", focusedPane: "list" });
    useUiStore.getState().selectAccount("acc-1");

    const user = userEvent.setup();
    render(<ArticleList />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText(sampleArticles[0].title)).toBeInTheDocument();
    });

    expect(screen.getByText("Subscriptions")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Show sidebar" }));

    expect(useUiStore.getState().focusedPane).toBe("sidebar");
  });

  it("returns focus to the selected article row when closing web preview", async () => {
    useUiStore.getState().selectAccount("acc-1");
    useUiStore.getState().selectFeed("feed-1");
    useUiStore.getState().setViewMode("all");
    useUiStore.getState().selectArticle("art-1");

    render(
      <>
        <ArticleList />
        <ArticleView />
      </>,
      { wrapper: createWrapper() },
    );

    const openBrowserButton = await screen.findByRole("button", { name: "Open Web Preview" });
    openBrowserButton.focus();

    window.dispatchEvent(new Event(keyboardEvents.openInAppBrowser));

    await waitFor(() => {
      expect(useUiStore.getState().contentMode).toBe("browser");
    });

    const host = screen.getByTestId("browser-webview-host");
    host.setAttribute("tabindex", "-1");
    host.focus();
    expect(host).toHaveFocus();

    window.dispatchEvent(new Event(keyboardEvents.closeBrowserOverlay));

    await waitFor(() => {
      expect(useUiStore.getState().contentMode).toBe("reader");
      expect(useUiStore.getState().focusedPane).toBe("list");
      expect(screen.getByRole("option", { name: /First Article/ })).toHaveFocus();
    });
  });

  it("navigates articles from a focused list option using local key handling", async () => {
    useUiStore.getState().selectAccount("acc-1");
    useUiStore.getState().selectFeed("feed-1");
    useUiStore.getState().setViewMode("all");
    useUiStore.getState().selectArticle("art-1");

    render(<ArticleList />, { wrapper: createWrapper() });

    const firstOption = await screen.findByRole("option", { name: /First Article/ });
    firstOption.focus();
    expect(firstOption).toHaveFocus();

    fireEvent.keyDown(firstOption, { key: "j" });

    await waitFor(() => {
      expect(useUiStore.getState().selectedArticleId).toBe("art-2");
      expect(screen.getByRole("option", { name: /Second Article/ })).toHaveFocus();
    });
  });

  it("queues focused-row navigation while browser close is in flight", async () => {
    useUiStore.getState().selectAccount("acc-1");
    useUiStore.getState().selectFeed("feed-1");
    useUiStore.getState().setViewMode("all");
    useUiStore.getState().selectArticle("art-1");
    useUiStore.setState({
      browserCloseInFlight: true,
      pendingBrowserCloseAction: null,
    });

    render(<ArticleList />, { wrapper: createWrapper() });

    const firstOption = await screen.findByRole("option", { name: /First Article/ });
    firstOption.focus();
    expect(firstOption).toHaveFocus();

    fireEvent.keyDown(firstOption, { key: "j" });

    await waitFor(() => {
      expect(useUiStore.getState().pendingBrowserCloseAction).toBe("next-article");
      expect(useUiStore.getState().selectedArticleId).toBe("art-1");
    });
  });

  it("keeps web preview open when navigating to the next article", async () => {
    useUiStore.getState().selectAccount("acc-1");
    useUiStore.getState().selectFeed("feed-1");
    useUiStore.getState().setViewMode("all");
    useUiStore.getState().selectArticle("art-1");

    render(
      <>
        <ArticleList />
        <ArticleView />
      </>,
      { wrapper: createWrapper() },
    );

    await screen.findByRole("button", { name: "Open Web Preview" });
    await screen.findByRole("option", { name: /First Article/ });
    window.dispatchEvent(new Event(keyboardEvents.openInAppBrowser));

    await waitFor(() => {
      expect(useUiStore.getState().contentMode).toBe("browser");
      expect(useUiStore.getState().browserUrl).toBe("https://example.com/1");
    });

    window.dispatchEvent(new CustomEvent(APP_EVENTS.navigateArticle, { detail: 1 as const }));

    await waitFor(() => {
      expect(useUiStore.getState().selectedArticleId).toBe("art-2");
      expect(useUiStore.getState().contentMode).toBe("browser");
      expect(useUiStore.getState().browserUrl).toBe("https://example.com/2");
    });
  });

  it("returns to reader mode when selecting another article directly while web preview is open", async () => {
    useUiStore.getState().selectAccount("acc-1");
    useUiStore.getState().selectFeed("feed-1");
    useUiStore.getState().setViewMode("all");
    useUiStore.getState().selectArticle("art-1");

    render(
      <>
        <ArticleList />
        <ArticleView />
      </>,
      { wrapper: createWrapper() },
    );

    await screen.findByRole("button", { name: "Open Web Preview" });
    await screen.findByRole("option", { name: /First Article/ });
    window.dispatchEvent(new Event(keyboardEvents.openInAppBrowser));

    await waitFor(() => {
      expect(useUiStore.getState().contentMode).toBe("browser");
      expect(useUiStore.getState().browserUrl).toBe("https://example.com/1");
    });

    useUiStore.getState().selectArticle("art-2");

    await waitFor(() => {
      expect(useUiStore.getState().selectedArticleId).toBe("art-2");
      expect(useUiStore.getState().contentMode).toBe("reader");
      expect(useUiStore.getState().browserUrl).toBeNull();
    });
  });

  it("keeps reader mode after web preview was explicitly closed and then navigating articles", async () => {
    useUiStore.getState().selectAccount("acc-1");
    useUiStore.getState().selectFeed("feed-1");
    useUiStore.getState().selectArticle("art-1");

    render(
      <>
        <ArticleList />
        <ArticleView />
      </>,
      { wrapper: createWrapper() },
    );

    await screen.findByRole("button", { name: "Open Web Preview" });
    await screen.findByRole("option", { name: /First Article/ });
    window.dispatchEvent(new Event(keyboardEvents.openInAppBrowser));

    await waitFor(() => {
      expect(useUiStore.getState().contentMode).toBe("browser");
    });

    window.dispatchEvent(new Event(keyboardEvents.closeBrowserOverlay));

    await waitFor(() => {
      expect(useUiStore.getState().contentMode).toBe("reader");
      expect(useUiStore.getState().browserUrl).toBeNull();
    });

    useUiStore.getState().selectArticle("art-2");

    await waitFor(() => {
      expect(useUiStore.getState().selectedArticleId).toBe("art-2");
      expect(useUiStore.getState().contentMode).toBe("reader");
      expect(useUiStore.getState().browserUrl).toBeNull();
    });
  });

  it("updates the selected feed display preset from the header select", async () => {
    let feeds = sampleFeeds.filter((feed) => feed.account_id === "acc-1");
    const commands: Array<{ cmd: string; args: Record<string, unknown> }> = [];

    setupTauriMocks((cmd, args) => {
      commands.push({ cmd, args });
      switch (cmd) {
        case "list_feeds":
          return feeds.filter((feed) => feed.account_id === args.accountId);
        case "list_articles":
          return sampleArticles.filter((article) => article.feed_id === args.feedId);
        case "list_account_articles":
          return sampleArticles.filter((article) =>
            feeds.some((feed) => feed.id === article.feed_id && feed.account_id === args.accountId),
          );
        case "list_articles_by_tag":
          return [];
        case "search_articles":
          return [];
        case "update_feed_display_settings":
          feeds = feeds.map((feed) =>
            feed.id === args.feedId
              ? {
                  ...feed,
                  reader_mode: args.readerMode as "inherit" | "on" | "off",
                  web_preview_mode: args.webPreviewMode as "inherit" | "on" | "off",
                }
              : feed,
          );
          return null;
        default:
          return null;
      }
    });

    useUiStore.getState().selectAccount("acc-1");
    useUiStore.getState().selectFeed("feed-1");

    const user = userEvent.setup();
    render(<ArticleList />, { wrapper: createWrapper() });

    const displayPresetSelect = await screen.findByRole("combobox", { name: "Article display" });
    expect(displayPresetSelect).toHaveTextContent("Use default");

    await user.click(displayPresetSelect);
    await user.click(await screen.findByRole("option", { name: "Web Preview" }));

    await waitFor(() => {
      expect(commands).toContainEqual({
        cmd: "update_feed_display_settings",
        args: { feedId: "feed-1", readerMode: "on", webPreviewMode: "on" },
      });
      expect(screen.getByRole("combobox", { name: "Article display" })).toHaveTextContent("Web Preview");
    });
  });

  it("renders feed articles even when account-wide loading is still pending", async () => {
    setupTauriMocks((cmd, args) => {
      switch (cmd) {
        case "list_feeds":
          return sampleFeeds.filter((feed) => feed.account_id === args.accountId);
        case "list_articles":
          return sampleArticles.filter((article) => article.feed_id === args.feedId);
        case "list_account_articles":
          return new Promise(() => {
            // Keep the unrelated account query pending to reproduce the stuck loading state.
          });
        case "list_articles_by_tag":
          return [];
        case "search_articles":
          return [];
        default:
          return null;
      }
    });

    useUiStore.getState().selectAccount("acc-1");
    useUiStore.getState().selectFeed("feed-1");

    render(<ArticleList />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText(sampleArticles[0].title)).toBeInTheDocument();
    });
  });

  it("clears the selected article when the active filter excludes it", async () => {
    useUiStore.getState().selectAccount("acc-1");
    useUiStore.getState().selectFeed("feed-1");
    useUiStore.getState().selectArticle("art-1");

    const user = userEvent.setup();
    render(<ArticleList />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText(sampleArticles[0].title)).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "STARRED" }));

    await waitFor(() => {
      expect(useUiStore.getState().selectedArticleId).toBeNull();
      expect(useUiStore.getState().contentMode).toBe("empty");
    });
  });

  it("scrolls the viewport with a sticky-header inset when navigating upward", async () => {
    useUiStore.getState().selectAccount("acc-1");
    useUiStore.getState().selectFeed("feed-1");
    useUiStore.getState().selectArticle("art-2");

    render(<ArticleList />, { wrapper: createWrapper() });

    const list = await screen.findByRole("listbox", { name: "Article list" });
    await waitFor(() => {
      expect(within(list).getByRole("option", { name: /First Article/i })).toBeInTheDocument();
    });

    const viewport = list.closest('[data-slot="scroll-area-viewport"]') as HTMLDivElement | null;
    const header = list.querySelector('[data-group-header="true"]') as HTMLDivElement | null;
    const firstArticle = within(list).getByRole("option", { name: /First Article/i }) as HTMLButtonElement;

    expect(viewport).not.toBeNull();
    expect(header).not.toBeNull();
    if (!viewport || !header) {
      throw new Error("Expected article list viewport and sticky header to be rendered");
    }

    Object.defineProperty(viewport, "clientHeight", { configurable: true, value: 360 });
    Object.defineProperty(viewport, "scrollHeight", { configurable: true, value: 1200 });
    viewport.scrollTop = 240;
    viewport.getBoundingClientRect = () =>
      ({
        top: 100,
        bottom: 460,
        height: 360,
        left: 0,
        right: 0,
        width: 0,
        x: 0,
        y: 100,
        toJSON: () => ({}),
      }) as DOMRect;
    header.getBoundingClientRect = () =>
      ({
        top: 100,
        bottom: 132,
        height: 32,
        left: 0,
        right: 0,
        width: 0,
        x: 0,
        y: 100,
        toJSON: () => ({}),
      }) as DOMRect;
    firstArticle.getBoundingClientRect = () =>
      ({
        top: 220,
        bottom: 292,
        height: 72,
        left: 0,
        right: 0,
        width: 0,
        x: 0,
        y: 220,
        toJSON: () => ({}),
      }) as DOMRect;

    window.dispatchEvent(new CustomEvent(APP_EVENTS.navigateArticle, { detail: -1 as const }));

    await waitFor(() => {
      expect(useUiStore.getState().selectedArticleId).toBe("art-1");
      expect(viewport.scrollTop).toBe(316);
    });
  });

  it("removes articles from unread view after confirming mark all read", async () => {
    let articles = [
      { ...sampleArticles[0], is_read: false },
      { ...sampleArticles[1], is_read: true },
    ];
    let feeds = sampleFeeds.map((feed) =>
      feed.id === "feed-1"
        ? {
            ...feed,
            unread_count: articles.filter((article) => article.feed_id === feed.id && !article.is_read).length,
          }
        : feed,
    );

    setupTauriMocks((cmd, args) => {
      switch (cmd) {
        case "list_feeds":
          return feeds.filter((feed) => feed.account_id === args.accountId);
        case "list_articles":
          return articles.filter((article) => article.feed_id === args.feedId);
        case "list_account_articles":
          return articles.filter((article) =>
            feeds.some((feed) => feed.id === article.feed_id && feed.account_id === args.accountId),
          );
        case "list_articles_by_tag":
          return [];
        case "search_articles":
          return [];
        case "mark_articles_read": {
          const ids = new Set(args.articleIds as string[]);
          articles = articles.map((article) => (ids.has(article.id) ? { ...article, is_read: true } : article));
          feeds = feeds.map((feed) => ({
            ...feed,
            unread_count: articles.filter((article) => article.feed_id === feed.id && !article.is_read).length,
          }));
          return null;
        }
        default:
          return null;
      }
    });

    useUiStore.getState().selectAccount("acc-1");

    const user = userEvent.setup();
    render(
      <>
        <ArticleList />
        <AppConfirmDialog />
      </>,
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(screen.getByText("First Article")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Mark all as read" }));
    await user.click(screen.getByRole("button", { name: "Mark as Read" }));

    await waitFor(() => {
      expect(screen.queryByText("First Article")).not.toBeInTheDocument();
    });
  });

  it("does not render read articles in unread view even when recentlyReadIds contains them", async () => {
    const articles = [
      { ...sampleArticles[0], id: "art-read", title: "Read Article", is_read: true },
      { ...sampleArticles[1], id: "art-unread", title: "Unread Article", is_read: false, is_starred: false },
    ];

    setupTauriMocks((cmd, args) => {
      switch (cmd) {
        case "list_feeds":
          return sampleFeeds.filter((feed) => feed.account_id === args.accountId);
        case "list_articles":
          return articles.filter((article) => article.feed_id === args.feedId);
        case "list_account_articles":
          return articles.filter((article) =>
            sampleFeeds.some((feed) => feed.id === article.feed_id && feed.account_id === args.accountId),
          );
        case "list_articles_by_tag":
          return [];
        case "search_articles":
          return [];
        default:
          return null;
      }
    });

    useUiStore.setState({
      ...useUiStore.getInitialState(),
      selectedAccountId: "acc-1",
      selection: { type: "all" },
      viewMode: "unread",
      recentlyReadIds: new Set(["art-read"]),
    });

    render(<ArticleList />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText("Unread Article")).toBeInTheDocument();
      expect(screen.queryByText("Read Article")).not.toBeInTheDocument();
    });
  });

  it("keeps an auto-marked article in unread view until the user changes screens", async () => {
    let articles = [
      { ...sampleArticles[0], is_read: false, is_starred: false },
      { ...sampleArticles[1], is_read: true, is_starred: true },
    ];

    setupTauriMocks((cmd, args) => {
      switch (cmd) {
        case "list_feeds":
          return sampleFeeds.filter((feed) => feed.account_id === args.accountId);
        case "list_articles":
          return articles.filter((article) => article.feed_id === args.feedId);
        case "list_account_articles":
          return articles.filter((article) =>
            sampleFeeds.some((feed) => feed.id === article.feed_id && feed.account_id === args.accountId),
          );
        case "list_articles_by_tag":
          return [];
        case "list_tags":
        case "get_article_tags":
          return [];
        case "search_articles":
          return [];
        case "update_feed_display_settings":
          return null;
        case "mark_article_read":
          articles = articles.map((article) =>
            article.id === args.articleId ? { ...article, is_read: Boolean(args.read) } : article,
          );
          return null;
        default:
          return null;
      }
    });

    useUiStore.getState().selectAccount("acc-1");
    useUiStore.getState().selectFeed("feed-1");
    useUiStore.getState().selectArticle("art-1");

    const user = userEvent.setup();
    render(
      <>
        <ArticleList />
        <ArticleView />
      </>,
      { wrapper: createWrapper() },
    );

    const list = await screen.findByRole("listbox", { name: "Article list" });
    await waitFor(() => {
      expect(within(list).getByRole("option", { name: /First Article/ })).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(within(list).getByRole("option", { name: "First Article" })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "STARRED" }));

    await waitFor(() => {
      expect(within(list).queryByRole("option", { name: "First Article" })).not.toBeInTheDocument();
    });
  });

  it("keeps an unstarred article in starred view until the user changes screens", async () => {
    let articles = [
      { ...sampleArticles[0], is_read: false, is_starred: false },
      { ...sampleArticles[1], is_read: true, is_starred: true },
    ];

    setupTauriMocks((cmd, args) => {
      switch (cmd) {
        case "list_feeds":
          return sampleFeeds.filter((feed) => feed.account_id === args.accountId);
        case "list_articles":
          return articles.filter((article) => article.feed_id === args.feedId);
        case "list_account_articles":
          return articles.filter((article) =>
            sampleFeeds.some((feed) => feed.id === article.feed_id && feed.account_id === args.accountId),
          );
        case "list_articles_by_tag":
          return [];
        case "list_tags":
        case "get_article_tags":
          return [];
        case "search_articles":
          return [];
        case "update_feed_display_settings":
          return null;
        case "toggle_article_star":
          articles = articles.map((article) =>
            article.id === args.articleId ? { ...article, is_starred: Boolean(args.starred) } : article,
          );
          return null;
        default:
          return null;
      }
    });

    useUiStore.getState().selectAccount("acc-1");
    useUiStore.getState().selectSmartView("starred");
    useUiStore.getState().selectArticle("art-2");

    const user = userEvent.setup();
    render(
      <>
        <ArticleList />
        <ArticleView />
      </>,
      { wrapper: createWrapper() },
    );

    const list = await screen.findByRole("listbox", { name: "Article list" });
    await waitFor(() => {
      expect(within(list).getByRole("option", { name: /Second Article/ })).toBeInTheDocument();
    });

    await user.click(await screen.findByRole("button", { name: "Toggle star" }));

    await waitFor(() => {
      expect(within(list).getByRole("option", { name: "Second Article" })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "UNREAD" }));

    await waitFor(() => {
      expect(within(list).queryByRole("option", { name: "Second Article" })).not.toBeInTheDocument();
    });
  });

  it("focuses the selected article row after closing web preview", async () => {
    setupTauriMocks((cmd, args) => {
      switch (cmd) {
        case "list_feeds":
          return sampleFeeds.filter((feed) => feed.account_id === args.accountId);
        case "list_articles":
          return sampleArticles.filter((article) => article.feed_id === args.feedId);
        case "list_account_articles":
          return sampleArticles.filter((article) =>
            sampleFeeds.some((feed) => feed.id === article.feed_id && feed.account_id === args.accountId),
          );
        case "list_articles_by_tag":
          return [];
        case "list_tags":
        case "get_article_tags":
          return [];
        case "search_articles":
          return [];
        case "create_or_update_browser_webview":
          return {
            url: args.url,
            can_go_back: false,
            can_go_forward: false,
            is_loading: true,
          };
        case "set_browser_webview_bounds":
        case "close_browser_webview":
          return null;
        default:
          return null;
      }
    });

    useUiStore.getState().selectAccount("acc-1");
    useUiStore.getState().selectFeed("feed-1");
    useUiStore.getState().selectArticle("art-1");

    const user = userEvent.setup();
    render(
      <>
        <ArticleList />
        <ArticleView />
      </>,
      { wrapper: createWrapper() },
    );

    const list = await screen.findByRole("listbox", { name: "Article list" });
    await waitFor(() => {
      expect(within(list).getByRole("option", { name: "First Article" })).toBeInTheDocument();
    });

    await user.click(await screen.findByRole("button", { name: "Open Web Preview" }));

    await waitFor(() => {
      expect(useUiStore.getState().contentMode).toBe("browser");
    });

    const host = screen.getByTestId("browser-webview-host");
    host.setAttribute("tabindex", "-1");
    host.focus();
    expect(host).toHaveFocus();

    window.dispatchEvent(new Event(keyboardEvents.closeBrowserOverlay));

    await waitFor(() => {
      expect(useUiStore.getState().contentMode).toBe("reader");
      expect(useUiStore.getState().focusedPane).toBe("list");
      expect(within(list).getByRole("option", { name: "First Article" })).toHaveFocus();
    });
  });

  it("shows smart unread context and keeps only a disabled unread footer control", async () => {
    useUiStore.getState().selectAccount("acc-1");
    useUiStore.getState().selectSmartView("unread");

    render(<ArticleList />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText(sampleArticles[0].title)).toBeInTheDocument();
    });

    expect(screen.getByText("Unread")).toHaveAttribute("data-emphasis", "primary");
    expect(screen.getByRole("button", { name: "UNREAD" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "UNREAD" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByRole("button", { name: "ALL" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "STARRED" })).not.toBeInTheDocument();
  });

  it("clamps smart unread to unread even if viewMode drifts elsewhere", async () => {
    useUiStore.setState({
      ...useUiStore.getInitialState(),
      selectedAccountId: "acc-1",
      selection: { type: "smart", kind: "unread" },
      viewMode: "all",
    });

    render(<ArticleList />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText(sampleArticles[0].title)).toBeInTheDocument();
    });

    expect(screen.queryByText(sampleArticles[1].title)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "UNREAD" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "ALL" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "STARRED" })).not.toBeInTheDocument();
  });

  it("shows smart starred context and limits footer controls to unread and all", async () => {
    useUiStore.getState().selectAccount("acc-1");
    useUiStore.getState().selectSmartView("starred");

    render(<ArticleList />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText(sampleArticles[1].title)).toBeInTheDocument();
    });

    const context = screen.getByText("Starred").closest("div");
    expect(context).not.toBeNull();
    if (!context) {
      throw new Error("Expected smart view context strip to be rendered");
    }
    expect(within(context).getByText("Starred")).toHaveAttribute("data-emphasis", "primary");
    expect(within(context).queryByText("ALL")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "UNREAD" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ALL" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "STARRED" })).not.toBeInTheDocument();
  });

  it("clamps smart starred away from invalid starred mode", async () => {
    useUiStore.setState({
      ...useUiStore.getInitialState(),
      selectedAccountId: "acc-1",
      selection: { type: "smart", kind: "starred" },
      viewMode: "starred",
    });

    render(<ArticleList />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText(sampleArticles[1].title)).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: "ALL" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "UNREAD" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByRole("button", { name: "STARRED" })).not.toBeInTheDocument();

    const context = screen.getByText("Starred").closest("div");
    expect(context).not.toBeNull();
    if (!context) {
      throw new Error("Expected smart view context strip to be rendered");
    }
    expect(within(context).queryByText("ALL")).not.toBeInTheDocument();
  });

  it("moves DOM focus to the newly selected row during keyboard article navigation", async () => {
    const user = userEvent.setup();

    useUiStore.setState({
      ...useUiStore.getInitialState(),
      selectedAccountId: "acc-1",
      selection: { type: "feed", feedId: "feed-1" },
      viewMode: "all",
    });

    render(<ArticleList />, { wrapper: createWrapper() });

    const secondRow = await screen.findByRole("option", { name: /Second Article/i });
    await user.click(secondRow);
    expect(secondRow).toHaveFocus();

    window.dispatchEvent(new CustomEvent(APP_EVENTS.navigateArticle, { detail: -1 as const }));

    await waitFor(() => {
      expect(useUiStore.getState().selectedArticleId).toBe("art-1");
    });

    await waitFor(() => {
      expect(screen.getByRole("option", { name: /First Article/i })).toHaveFocus();
    });
  });
});
