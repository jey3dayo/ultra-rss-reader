import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
          return sampleFeeds
            .filter((feed) => feed.account_id === args.accountId)
            .map((feed) => (feed.id === "feed-1" ? { ...feed, reader_mode: "on", web_preview_mode: "on" } : feed));
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
        case "update_feed_display_settings":
          return null;
        default:
          return undefined;
      }
    });
  });

  it("uses the close button to return to the list in compact layout", async () => {
    setupTauriMocks((cmd, args) => {
      switch (cmd) {
        case "list_articles":
          return sampleArticles.filter((article) => article.feed_id === args.feedId);
        case "list_account_articles":
          return sampleArticles.filter((article) =>
            sampleFeeds.some((feed) => feed.id === article.feed_id && feed.account_id === args.accountId),
          );
        case "list_feeds":
          return sampleFeeds
            .filter((feed) => feed.account_id === args.accountId)
            .map((feed) => (feed.id === "feed-1" ? { ...feed, reader_mode: "on", web_preview_mode: "off" } : feed));
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
    useUiStore.setState({ layoutMode: "compact", focusedPane: "content" });

    const user = userEvent.setup();
    render(<ArticleView />, { wrapper: createWrapper() });

    const button = await screen.findByRole("button", { name: "Close article" });
    await user.click(button);

    await waitFor(() => {
      expect(useUiStore.getState().focusedPane).toBe("list");
      expect(useUiStore.getState().contentMode).toBe("empty");
    });
  });

  it("opens the external browser from the article title when open_links is in_app", async () => {
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
        case "update_feed_display_settings":
        case "open_in_browser":
          return null;
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
    usePreferencesStore.setState({ prefs: { open_links: "in_app" }, loaded: true });

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

  it("keeps the embedded browser preview toggle available when action_open_browser is false", async () => {
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
        case "create_or_update_browser_webview":
          return {
            url: args.url,
            can_go_back: false,
            can_go_forward: false,
            is_loading: true,
          };
        case "set_browser_webview_bounds":
        case "close_browser_webview":
        case "update_feed_display_settings":
          return null;
        default:
          return undefined;
      }
    });

    useUiStore.getState().selectAccount("acc-1");
    useUiStore.getState().selectFeed("feed-1");
    useUiStore.getState().selectArticle("art-1");
    usePreferencesStore.setState({ prefs: { action_open_browser: "false" }, loaded: true });

    render(<ArticleView />, { wrapper: createWrapper() });

    calls.length = 0;

    expect(screen.queryByText("S")).not.toBeInTheDocument();
    expect(screen.queryByText("P")).not.toBeInTheDocument();

    const openBrowserButton = await screen.findByRole("button", { name: "Open Web Preview" });
    expect(openBrowserButton).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(openBrowserButton);

    expect(calls.map(({ cmd }) => cmd)).not.toContain("open_in_browser");

    await waitFor(() => {
      expect(useUiStore.getState().contentMode).toBe("browser");
      expect(useUiStore.getState().browserUrl).toBe("https://example.com/1");
    });

    const closingButtons = await screen.findAllByRole("button", { name: "Close Web Preview" });
    const toolbarCloseButton = closingButtons.find((button) => button.getAttribute("aria-pressed") === "true");
    expect(toolbarCloseButton).toBeDefined();
    if (!toolbarCloseButton) {
      throw new Error("expected toolbar close button");
    }

    fireEvent.click(toolbarCloseButton);

    await waitFor(() => {
      expect(useUiStore.getState().contentMode).toBe("reader");
      expect(useUiStore.getState().browserUrl).toBeNull();
    });

    expect(calls.map(({ cmd }) => cmd)).not.toContain("open_in_browser");
    expect(await screen.findByRole("button", { name: "Open Web Preview" })).toHaveAttribute("aria-pressed", "false");
  });

  it("hides the article close action while web preview is open", async () => {
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
          return [];
        case "get_article_tags":
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
          return undefined;
      }
    });

    useUiStore.getState().selectAccount("acc-1");
    useUiStore.getState().selectFeed("feed-1");
    useUiStore.getState().selectArticle("art-1");

    render(<ArticleView />, { wrapper: createWrapper() });

    expect(await screen.findByRole("button", { name: "Close article" })).toBeInTheDocument();

    fireEvent.click(await screen.findByRole("button", { name: "Open Web Preview" }));

    await waitFor(() => {
      expect(useUiStore.getState().contentMode).toBe("browser");
      expect(screen.queryByRole("button", { name: "Close article" })).not.toBeInTheDocument();
    });

    const closeButtons = await screen.findAllByRole("button", { name: "Close Web Preview" });
    const overlayCloseButton = closeButtons.find((button) => button.getAttribute("aria-pressed") !== "true");
    if (!overlayCloseButton) {
      throw new Error("expected overlay close button");
    }

    fireEvent.click(overlayCloseButton);

    await waitFor(() => {
      expect(useUiStore.getState().contentMode).toBe("reader");
      expect(useUiStore.getState().browserUrl).toBeNull();
    });
  });

  it("closes only the current article overlay when the overlay close button is pressed", async () => {
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
          return [];
        case "get_article_tags":
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
          return undefined;
      }
    });

    useUiStore.getState().selectAccount("acc-1");
    useUiStore.getState().selectFeed("feed-1");
    useUiStore.getState().selectArticle("art-1");

    render(<ArticleView />, { wrapper: createWrapper() });

    const openBrowserButton = await screen.findByRole("button", { name: "Open Web Preview" });
    openBrowserButton.focus();
    window.dispatchEvent(new Event(keyboardEvents.openInAppBrowser));

    await waitFor(() => {
      expect(useUiStore.getState().contentMode).toBe("browser");
      expect(useUiStore.getState().browserUrl).toBe("https://example.com/1");
    });

    const closeButtons = await screen.findAllByRole("button", { name: "Close Web Preview" });
    const overlayCloseButton = closeButtons.find((button) => button.getAttribute("aria-pressed") !== "true");
    expect(overlayCloseButton).toBeDefined();
    if (!overlayCloseButton) {
      throw new Error("expected overlay close button");
    }

    fireEvent.click(overlayCloseButton);

    await waitFor(() => {
      expect(useUiStore.getState().contentMode).toBe("reader");
      expect(useUiStore.getState().browserUrl).toBeNull();
      expect(useUiStore.getState().selectedArticleId).toBe("art-1");
    });
  });

  it("closes the browser overlay on Escape and restores focus to the trigger", async () => {
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
          return [];
        case "get_article_tags":
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
          return undefined;
      }
    });

    useUiStore.getState().selectAccount("acc-1");
    useUiStore.getState().selectFeed("feed-1");
    useUiStore.getState().selectArticle("art-1");

    render(<ArticleView />, { wrapper: createWrapper() });

    const openBrowserButton = await screen.findByRole("button", { name: "Open Web Preview" });
    openBrowserButton.focus();
    window.dispatchEvent(new Event(keyboardEvents.openInAppBrowser));

    await waitFor(() => {
      expect(useUiStore.getState().contentMode).toBe("browser");
      expect(useUiStore.getState().browserUrl).toBe("https://example.com/1");
    });

    const closeButtons = await screen.findAllByRole("button", { name: "Close Web Preview" });
    const closeOverlayButton = closeButtons.find((button) => button.getAttribute("aria-pressed") !== "true");
    expect(closeOverlayButton).toBeDefined();
    if (!closeOverlayButton) {
      throw new Error("expected overlay close button");
    }

    closeOverlayButton.focus();
    expect(closeOverlayButton).toHaveFocus();

    fireEvent.keyDown(window, { key: "Escape" });

    await waitFor(() => {
      expect(useUiStore.getState().contentMode).toBe("reader");
      expect(useUiStore.getState().browserUrl).toBeNull();
      expect(openBrowserButton).toHaveFocus();
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

  it("keeps feed navigation separate after opening the article title in the external browser", async () => {
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
          return null;
        default:
          return undefined;
      }
    });

    useUiStore.getState().selectAccount("acc-1");
    useUiStore.getState().selectFeed("feed-1");
    useUiStore.getState().selectArticle("art-1");
    usePreferencesStore.setState({ prefs: { open_links: "in_app" }, loaded: true });

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

    expect(screen.getByRole("heading", { level: 1, name: "First Article" })).toBeInTheDocument();
    expect(useUiStore.getState().contentMode).toBe("reader");
    expect(useUiStore.getState().browserUrl).toBeNull();

    const feedButton = screen.getByRole("button", { name: "Tech Blog" });
    feedButton.click();

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

    expect(await screen.findByText("Copy link", {}, { timeout: 5000 })).toBeInTheDocument();
  }, 10000);

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

    await user.click(await screen.findByRole("button", { name: "Open in External Browser" }));

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
        default:
          return undefined;
      }
    });

    useUiStore.getState().selectAccount("acc-1");
    useUiStore.getState().selectFeed("feed-1");
    useUiStore.getState().selectArticle("art-1");

    const user = userEvent.setup();
    render(<ArticleView />, { wrapper: createWrapper() });

    await user.click(await screen.findByRole("button", { name: "Open in External Browser" }));

    await waitFor(() => {
      expect(useUiStore.getState().toastMessage).toEqual({ message: "Could not launch browser" });
    });
  });

  it("uses the close button as UI navigation back from the reader", async () => {
    setupTauriMocks((cmd, args) => {
      switch (cmd) {
        case "list_articles":
          return sampleArticles.filter((article) => article.feed_id === args.feedId);
        case "list_account_articles":
          return sampleArticles.filter((article) =>
            sampleFeeds.some((feed) => feed.id === article.feed_id && feed.account_id === args.accountId),
          );
        case "list_feeds":
          return sampleFeeds
            .filter((feed) => feed.account_id === args.accountId)
            .map((feed) => (feed.id === "feed-1" ? { ...feed, reader_mode: "on", web_preview_mode: "off" } : feed));
        case "list_tags":
          return [];
        case "get_article_tags":
          return [];
        default:
          return undefined;
      }
    });

    useUiStore.getState().selectAccount("acc-1");
    useUiStore.getState().selectFeed("feed-1");
    useUiStore.getState().selectArticle("art-1");

    const user = userEvent.setup();
    render(<ArticleView />, { wrapper: createWrapper() });

    await user.click(await screen.findByRole("button", { name: "Close article" }));

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

  it("auto opens browser mode for all-items selection when the current feed enables web preview", async () => {
    setupTauriMocks((cmd, args) => {
      switch (cmd) {
        case "list_account_articles":
          return sampleArticles;
        case "list_feeds":
          return sampleFeeds
            .filter((feed) => feed.account_id === args.accountId)
            .map((feed) => (feed.id === "feed-1" ? { ...feed, reader_mode: "on", web_preview_mode: "on" } : feed));
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
      prefs: { reader_mode_default: "true", web_preview_mode_default: "false" },
      loaded: true,
    });

    render(<ArticleView />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(useUiStore.getState().contentMode).toBe("browser");
      expect(useUiStore.getState().browserUrl).toBe("https://example.com/1");
    });
  });

  it("preserves the image-viewer overlay URL when the image-viewer scenario runs in the mounted app", async () => {
    const overlayUrl = new URL("/dev-image-viewer.html", window.location.origin).toString();

    setupTauriMocks((cmd, args) => {
      switch (cmd) {
        case "list_articles":
          return sampleArticles.filter((article) => article.feed_id === args.feedId);
        case "list_feeds":
          return sampleFeeds
            .filter((feed) => feed.account_id === args.accountId)
            .map((feed) => (feed.id === "feed-1" ? { ...feed, reader_mode: "on", web_preview_mode: "on" } : feed));
        case "list_tags":
          return [];
        case "get_article_tags":
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
          return undefined;
      }
    });

    usePreferencesStore.setState({
      prefs: { reader_mode_default: "true", web_preview_mode_default: "false" },
      loaded: true,
    });

    render(<ArticleView />, { wrapper: createWrapper() });

    useUiStore.getState().selectAccount("acc-1");
    useUiStore.getState().selectFeed("feed-1");
    useUiStore.getState().setViewMode("all");
    useUiStore.getState().selectArticle("art-1");
    useUiStore.getState().openBrowser(overlayUrl);

    window.setTimeout(() => {
      useUiStore.getState().selectAccount("acc-1");
      useUiStore.getState().selectFeed("feed-1");
      useUiStore.getState().setViewMode("all");
      useUiStore.getState().selectArticle("art-1");
      useUiStore.getState().openBrowser(overlayUrl);
    }, 300);
    window.setTimeout(() => {
      useUiStore.getState().selectAccount("acc-1");
      useUiStore.getState().selectFeed("feed-1");
      useUiStore.getState().setViewMode("all");
      useUiStore.getState().selectArticle("art-1");
      useUiStore.getState().openBrowser(overlayUrl);
    }, 1200);

    await new Promise((resolve) => window.setTimeout(resolve, 1600));

    expect(useUiStore.getState().selectedArticleId).not.toBeNull();
    expect(useUiStore.getState().contentMode).toBe("browser");
    expect(useUiStore.getState().browserUrl).toBe(overlayUrl);
  }, 10000);

  it("keeps explicit reader-only feeds in reader mode even when the global default enables web preview", async () => {
    setupTauriMocks((cmd, args) => {
      switch (cmd) {
        case "list_articles":
          return sampleArticles.filter((article) => article.feed_id === args.feedId);
        case "list_feeds":
          return sampleFeeds
            .filter((feed) => feed.account_id === args.accountId)
            .map((feed) => (feed.id === "feed-1" ? { ...feed, reader_mode: "on", web_preview_mode: "off" } : feed));
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
      prefs: { reader_mode_default: "true", web_preview_mode_default: "true" },
      loaded: true,
    });

    render(<ArticleView />, { wrapper: createWrapper() });

    await screen.findByRole("heading", { level: 1, name: "First Article" });

    expect(useUiStore.getState().contentMode).toBe("reader");
    expect(useUiStore.getState().browserUrl).toBeNull();
  });

  it("renders the reader after account articles finish loading", async () => {
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
      prefs: { reader_mode_default: "true", web_preview_mode_default: "false" },
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
      expect(screen.getByRole("heading", { level: 1, name: "First Article" })).toBeInTheDocument();
    });

    expect(useUiStore.getState().contentMode).toBe("reader");
    expect(useUiStore.getState().browserUrl).toBeNull();
  });

  it("renders the feed cleanup page instead of the reader when cleanup is open", async () => {
    useUiStore.setState({
      ...useUiStore.getInitialState(),
      selectedAccountId: "acc-1",
      selection: { type: "feed", feedId: "feed-1" },
      selectedArticleId: "art-1",
      contentMode: "reader",
      feedCleanupOpen: true,
    });

    render(<ArticleView />, { wrapper: createWrapper() });

    expect(await screen.findByRole("heading", { name: "Feed Cleanup" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 1, name: "First Article" })).not.toBeInTheDocument();
  });

  it("renders the share menu button when an article is selected", async () => {
    useUiStore.getState().selectAccount("acc-1");
    useUiStore.getState().selectFeed("feed-1");
    useUiStore.getState().selectArticle("art-1");

    render(<ArticleView />, { wrapper: createWrapper() });

    const shareButton = await screen.findByRole("button", { name: "Share" });
    expect(shareButton).toBeInTheDocument();
    expect(shareButton).toBeEnabled();
    expect(shareButton).toHaveClass("size-11", "md:size-8", "rounded-lg", "text-muted-foreground");
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
        case "update_feed_display_settings":
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
        case "update_feed_display_settings":
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
