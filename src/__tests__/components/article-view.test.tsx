import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ArticlePane, ArticleToolbar, ArticleView } from "@/components/reader/article-view";
import { keyboardEvents } from "@/lib/keyboard-shortcuts";
import { usePlatformStore } from "@/stores/platform-store";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";
import { createWrapper } from "../../../tests/helpers/create-wrapper";
import {
  type MockTauriCommandCall,
  sampleArticles,
  sampleFeeds,
  setupTauriMocks,
} from "../../../tests/helpers/tauri-mocks";

vi.mock("@/hooks/use-resolved-dev-intent", () => ({
  useResolvedDevIntent: () => ({
    intent: null,
    ready: true,
  }),
}));

const ciWaitOptions = { timeout: 20_000 };
const readingListTestTimeout = 30_000;
const primaryArticle = sampleArticles[0];
const primaryFeed = sampleFeeds[0];

function setReadingListPlatformSupport(enabled: boolean) {
  usePlatformStore.setState({
    platform: {
      kind: enabled ? "macos" : "windows",
      capabilities: {
        supports_reading_list: enabled,
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
}

describe("ArticleView", () => {
  beforeEach(() => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: 1400,
    });
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      writable: true,
      value: 900,
    });
    useUiStore.setState(useUiStore.getInitialState());
    usePreferencesStore.setState({ prefs: {}, loaded: false });
    usePlatformStore.setState(usePlatformStore.getInitialState());
    setReadingListPlatformSupport(false);
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

  it("opens the web preview from the article title when open_links is in_app", async () => {
    const calls: MockTauriCommandCall[] = [];
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
        case "create_or_update_browser_webview":
          return {
            url: args.url,
            can_go_back: false,
            can_go_forward: false,
            is_loading: true,
          };
        case "check_browser_embed_support":
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
      expect(useUiStore.getState().contentMode).toBe("browser");
      expect(useUiStore.getState().browserUrl).toBe("https://example.com/1");
    });

    expect(calls).not.toContainEqual({
      cmd: "open_in_browser",
      args: { url: "https://example.com/1", background: false },
    });
    expect(calls.filter(({ cmd }) => cmd === "update_feed_display_settings")).toHaveLength(0);
  });

  it("opens sanitized article links in the external browser", async () => {
    const calls: MockTauriCommandCall[] = [];
    setupTauriMocks((cmd, args) => {
      calls.push({ cmd, args });

      switch (cmd) {
        case "list_tags":
          return [];
        case "get_article_tags":
          return [];
        case "open_in_browser":
        case "update_feed_display_settings":
          return null;
        default:
          return undefined;
      }
    });

    render(
      <ArticlePane
        article={{
          ...primaryArticle,
          content_sanitized: '<p><a href="https://example.com/from-content">Read more</a></p>',
        }}
        feed={primaryFeed}
        feedName="Feed One"
      />,
      { wrapper: createWrapper() },
    );

    calls.length = 0;
    await userEvent.setup().click(screen.getByRole("link", { name: "Read more" }));

    await waitFor(() => {
      expect(calls).toContainEqual({
        cmd: "open_in_browser",
        args: { url: "https://example.com/from-content", background: false },
      });
    });
  });

  it("keeps the embedded browser preview toggle available when action_open_browser is false", async () => {
    const calls: MockTauriCommandCall[] = [];
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

    fireEvent.click(
      await within(screen.getByTestId("browser-overlay-chrome")).findByRole("button", { name: "Close Web Preview" }),
    );

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

    fireEvent.click(
      await within(screen.getByTestId("browser-overlay-chrome")).findByRole("button", { name: "Close Web Preview" }),
    );

    await waitFor(() => {
      expect(useUiStore.getState().contentMode).toBe("reader");
      expect(useUiStore.getState().browserUrl).toBeNull();
    });
  });

  it("renders browser navigation controls inside the web preview header", async () => {
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
        case "open_in_browser":
          return null;
        default:
          return undefined;
      }
    });

    useUiStore.getState().selectAccount("acc-1");
    useUiStore.getState().selectFeed("feed-1");
    useUiStore.getState().selectArticle("art-1");

    render(<ArticleView />, { wrapper: createWrapper() });

    fireEvent.click(await screen.findByRole("button", { name: "Open Web Preview" }));

    await waitFor(() => {
      expect(useUiStore.getState().contentMode).toBe("browser");
    });

    const overlayActions = screen.getByTestId("browser-overlay-actions");

    expect(
      within(screen.getByTestId("browser-overlay-chrome")).getByRole("button", { name: "Close Web Preview" }),
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId("browser-overlay-chrome")).getByRole("button", { name: "Web back" }),
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId("browser-overlay-chrome")).getByRole("button", { name: "Web forward" }),
    ).toBeInTheDocument();
    expect(within(overlayActions).getByRole("button", { name: "Reload page" })).toBeInTheDocument();
    expect(within(overlayActions).getByRole("button", { name: "Open in External Browser" })).toBeInTheDocument();
    expect(within(overlayActions).getByRole("button", { name: "Share" })).toBeInTheDocument();
  });

  it("renders compact overlay toolbar actions as separate shell surfaces", async () => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: 500,
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
        case "open_in_browser":
          return null;
        default:
          return undefined;
      }
    });

    useUiStore.getState().selectAccount("acc-1");
    useUiStore.getState().selectFeed("feed-1");
    useUiStore.getState().selectArticle("art-1");

    render(<ArticleView />, { wrapper: createWrapper() });

    fireEvent.click(await screen.findByRole("button", { name: "Open Web Preview" }));

    await waitFor(() => {
      expect(useUiStore.getState().contentMode).toBe("browser");
    });

    const overlayActions = screen.getByTestId("browser-overlay-actions");
    const customActionShells = within(overlayActions)
      .getAllByRole("button")
      .filter((button) =>
        ["Reload page", "Open in External Browser", "Share"].includes(
          button.getAttribute("aria-label") ?? button.textContent ?? "",
        ),
      )
      .map((button) => button.closest("[data-overlay-shell='action']"));

    expect(customActionShells.length).toBeGreaterThan(1);
    expect(customActionShells.every((shell) => shell?.className.includes("size-11"))).toBe(true);
  });

  it("closes only the current article overlay when the overlay close button is pressed", async () => {
    const calls: MockTauriCommandCall[] = [];
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

    fireEvent.click(
      await within(screen.getByTestId("browser-overlay-chrome")).findByRole("button", { name: "Close Web Preview" }),
    );

    await waitFor(() => {
      expect(useUiStore.getState().contentMode).toBe("reader");
      expect(useUiStore.getState().browserUrl).toBeNull();
      expect(useUiStore.getState().selectedArticleId).toBe("art-1");
    });

    await waitFor(() => {
      expect(screen.queryByTestId("browser-overlay-shell")).not.toBeInTheDocument();
      expect(calls.some((call) => call.cmd === "close_browser_webview")).toBe(true);
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

    const closeOverlayButton = await within(screen.getByTestId("browser-overlay-chrome")).findByRole("button", {
      name: "Close Web Preview",
    });
    closeOverlayButton.focus();
    expect(closeOverlayButton).toHaveFocus();

    fireEvent.keyDown(window, { key: "Escape" });

    await waitFor(() => {
      expect(useUiStore.getState().contentMode).toBe("reader");
      expect(useUiStore.getState().browserUrl).toBeNull();
      expect(screen.getByRole("button", { name: "Open Web Preview" })).toHaveFocus();
    });
  });

  it("restores focus to the original trigger when close is requested from the browser surface", async () => {
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
    });

    const host = screen.getByTestId("browser-webview-host");
    host.setAttribute("tabindex", "-1");
    host.focus();
    expect(host).toHaveFocus();

    window.dispatchEvent(new Event(keyboardEvents.closeBrowserOverlay));

    await waitFor(() => {
      expect(useUiStore.getState().contentMode).toBe("reader");
      expect(screen.getByRole("button", { name: "Open Web Preview" })).toHaveFocus();
    });
  });

  it("waits for the native browser webview to close before returning to reader mode", async () => {
    let resolveClose: (() => void) | undefined;

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
          return null;
        case "close_browser_webview":
          return new Promise<void>((resolve) => {
            resolveClose = resolve;
          });
        default:
          return undefined;
      }
    });

    useUiStore.getState().selectAccount("acc-1");
    useUiStore.getState().selectFeed("feed-1");
    useUiStore.getState().selectArticle("art-1");

    render(<ArticleView />, { wrapper: createWrapper() });

    await screen.findByRole("button", { name: "Open Web Preview" });
    window.dispatchEvent(new Event(keyboardEvents.openInAppBrowser));

    await waitFor(() => {
      expect(useUiStore.getState().contentMode).toBe("browser");
    });

    window.dispatchEvent(new Event(keyboardEvents.closeBrowserOverlay));

    expect(useUiStore.getState().contentMode).toBe("browser");
    expect(useUiStore.getState().browserUrl).toBe("https://example.com/1");

    resolveClose?.();

    await waitFor(() => {
      expect(useUiStore.getState().contentMode).toBe("reader");
      expect(useUiStore.getState().browserUrl).toBeNull();
    });
  });

  it("opens the external browser from the article title when open_links is default_browser", async () => {
    const calls: MockTauriCommandCall[] = [];
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

  it("keeps feed navigation separate after opening the article title in the web preview", async () => {
    const calls: MockTauriCommandCall[] = [];
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
        case "create_or_update_browser_webview":
          return {
            url: args.url,
            can_go_back: false,
            can_go_forward: false,
            is_loading: true,
          };
        case "check_browser_embed_support":
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
      expect(useUiStore.getState().contentMode).toBe("browser");
      expect(useUiStore.getState().browserUrl).toBe("https://example.com/1");
    });

    expect(screen.getByText("First Article")).toBeInTheDocument();
    expect(calls).not.toContainEqual({
      cmd: "open_in_browser",
      args: { url: "https://example.com/1", background: false },
    });

    await user.click(within(screen.getByTestId("browser-overlay-chrome")).getAllByRole("button")[0]);

    await waitFor(() => {
      expect(useUiStore.getState().contentMode).toBe("reader");
      expect(useUiStore.getState().browserUrl).toBeNull();
    });

    const feedButton = screen.getByRole("button", { name: "Tech Blog" });
    feedButton.click();

    await waitFor(() => {
      expect(useUiStore.getState().selection).toEqual({ type: "feed", feedId: "feed-1" });
      expect(useUiStore.getState().contentMode).toBe("empty");
    });
  });

  it("opens the external browser from the article title on modifier click", async () => {
    const calls: MockTauriCommandCall[] = [];
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

    render(<ArticleView />, { wrapper: createWrapper() });

    const titleButton = await screen.findByRole("button", { name: "First Article" });
    calls.length = 0;
    fireEvent.click(titleButton, { metaKey: true });

    await waitFor(() => {
      expect(calls).toContainEqual({
        cmd: "open_in_browser",
        args: { url: "https://example.com/1", background: false },
      });
    });

    expect(useUiStore.getState().contentMode).toBe("reader");
    expect(useUiStore.getState().browserUrl).toBeNull();
  });

  it("opens the external browser from the article title on middle click", async () => {
    const calls: MockTauriCommandCall[] = [];
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

    render(<ArticleView />, { wrapper: createWrapper() });

    const titleButton = await screen.findByRole("button", { name: "First Article" });
    calls.length = 0;
    fireEvent(titleButton, new MouseEvent("auxclick", { bubbles: true, button: 1 }));

    await waitFor(() => {
      expect(calls).toContainEqual({
        cmd: "open_in_browser",
        args: { url: "https://example.com/1", background: false },
      });
    });

    expect(useUiStore.getState().contentMode).toBe("reader");
    expect(useUiStore.getState().browserUrl).toBeNull();
  });

  it("renders icon-only article toolbar actions", async () => {
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
          return [
            { id: "tag-1", name: "Later", color: null },
            { id: "tag-2", name: "Important", color: "#ff0000" },
          ];
        case "get_article_tags":
          return [{ id: "tag-1", name: "Later", color: null }];
        default:
          return undefined;
      }
    });

    useUiStore.getState().selectAccount("acc-1");
    useUiStore.getState().selectFeed("feed-1");
    useUiStore.getState().selectArticle("art-1");

    render(<ArticleView />, { wrapper: createWrapper() });

    expect(await screen.findByRole("button", { name: "Copy link" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open in External Browser" })).toBeInTheDocument();
  });

  it("opens the external browser from the toolbar button", async () => {
    const calls: MockTauriCommandCall[] = [];
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
          return sampleFeeds
            .filter((feed) => feed.account_id === args.accountId)
            .map((feed) => (feed.id === "feed-1" ? { ...feed, reader_mode: "on", web_preview_mode: "off" } : feed));
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
          return sampleFeeds
            .filter((feed) => feed.account_id === args.accountId)
            .map((feed) => (feed.id === "feed-1" ? { ...feed, reader_mode: "on", web_preview_mode: "off" } : feed));
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
    const calls: MockTauriCommandCall[] = [];
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

  it("auto-marks the selected article as read only once", async () => {
    const calls: MockTauriCommandCall[] = [];
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
        case "mark_article_read":
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
    usePreferencesStore.setState({
      prefs: { after_reading: "mark_as_read" },
      loaded: true,
    });

    render(<ArticleView />, { wrapper: createWrapper() });

    await screen.findByRole("heading", { level: 1, name: "First Article" });

    await waitFor(() => {
      const markCalls = calls.filter(
        (call) => call.cmd === "mark_article_read" && call.args.articleId === "art-1" && call.args.read === true,
      );
      expect(markCalls).toHaveLength(1);
    });
  });

  it("retains an auto-marked article in unread view before the read mutation resolves", async () => {
    setupTauriMocks((cmd, args) => {
      switch (cmd) {
        case "list_articles":
          return sampleArticles.filter((article) => article.feed_id === args.feedId);
        case "list_feeds":
          return sampleFeeds.filter((feed) => feed.account_id === args.accountId);
        case "list_tags":
          return [];
        case "get_article_tags":
          return [];
        case "mark_article_read":
          return new Promise(() => {
            // Keep the mutation pending to verify that retention happens immediately.
          });
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
      viewMode: "unread",
    });
    usePreferencesStore.setState({
      prefs: { after_reading: "mark_as_read" },
      loaded: true,
    });

    render(<ArticleView />, { wrapper: createWrapper() });

    await screen.findByRole("heading", { level: 1, name: "First Article" });

    await waitFor(() => {
      expect(useUiStore.getState().retainedArticleIds).toEqual(new Set(["art-1"]));
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

  it("renders web preview without a selected article when browser-only mode is requested", async () => {
    const previewUrl = "https://example.com/dev-preview";

    setupTauriMocks((cmd, args) => {
      switch (cmd) {
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
        case "list_tags":
        case "get_article_tags":
          return [];
        default:
          return undefined;
      }
    });

    useUiStore.setState({
      ...useUiStore.getInitialState(),
      contentMode: "browser",
      browserUrl: previewUrl,
    });

    render(<ArticleView />, { wrapper: createWrapper() });

    expect(await screen.findByRole("button", { name: "Close Web Preview" })).toBeInTheDocument();
    expect(screen.queryByText("Select an article to read")).not.toBeInTheDocument();
    expect(useUiStore.getState().contentMode).toBe("browser");
    expect(useUiStore.getState().browserUrl).toBe(previewUrl);
  });

  it("closes browser-only preview back to the empty state from shared shell controls", async () => {
    const previewUrl = "https://example.com/dev-preview";

    setupTauriMocks((cmd, args) => {
      switch (cmd) {
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
        case "list_tags":
        case "get_article_tags":
          return [];
        default:
          return undefined;
      }
    });

    const { rerender } = render(<ArticleView />, { wrapper: createWrapper() });

    useUiStore.setState({
      ...useUiStore.getInitialState(),
      contentMode: "browser",
      browserUrl: previewUrl,
    });
    rerender(<ArticleView />);

    await userEvent.setup().click(await screen.findByRole("button", { name: "Close Web Preview" }));

    await waitFor(() => {
      expect(useUiStore.getState().contentMode).toBe("empty");
      expect(useUiStore.getState().browserUrl).toBeNull();
      expect(screen.getByText("Select an article to read")).toBeInTheDocument();
    });

    useUiStore.setState({
      ...useUiStore.getInitialState(),
      contentMode: "browser",
      browserUrl: previewUrl,
    });
    rerender(<ArticleView />);

    await screen.findByTestId("browser-overlay-shell");
    fireEvent.keyDown(window, { key: "Escape" });

    await waitFor(() => {
      expect(useUiStore.getState().contentMode).toBe("empty");
      expect(useUiStore.getState().browserUrl).toBeNull();
      expect(screen.getByText("Select an article to read")).toBeInTheDocument();
    });
  });

  it("keeps intent and article-driven entries on the same minimal viewer shell", async () => {
    const user = userEvent.setup();

    setupTauriMocks((cmd, args) => {
      switch (cmd) {
        case "list_articles":
          return sampleArticles.filter((article) => article.feed_id === args.feedId);
        case "list_feeds":
          return sampleFeeds.filter((feed) => feed.account_id === args.accountId);
        case "list_tags":
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

    useUiStore.setState({
      ...useUiStore.getInitialState(),
      selectedAccountId: "acc-1",
      selection: { type: "feed", feedId: "feed-1" },
      selectedArticleId: "art-1",
      contentMode: "reader",
    });

    const articleEntry = render(<ArticleView />, { wrapper: createWrapper() });

    await user.click(await screen.findByRole("button", { name: "Open Web Preview" }));

    await waitFor(() => {
      expect(useUiStore.getState().contentMode).toBe("browser");
      expect(useUiStore.getState().browserUrl).toBe("https://example.com/1");
    });

    expect(screen.getByTestId("browser-overlay-shell")).toBeInTheDocument();
    expect(screen.queryByText("Web Preview")).not.toBeInTheDocument();

    articleEntry.unmount();

    useUiStore.setState({
      ...useUiStore.getInitialState(),
      contentMode: "browser",
      browserUrl: "https://example.com/dev-preview",
    });

    render(<ArticleView />, { wrapper: createWrapper() });

    expect(screen.getByTestId("browser-overlay-shell")).toBeInTheDocument();
    expect(screen.queryByText("Web Preview")).not.toBeInTheDocument();
  });

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

  it("keeps the reader scroll region shrinkable when the web preview warning is shown", async () => {
    setupTauriMocks((cmd) => {
      switch (cmd) {
        case "list_tags":
          return [];
        case "get_article_tags":
          return [];
        default:
          return undefined;
      }
    });

    usePreferencesStore.setState({
      prefs: { reader_mode_default: "true", web_preview_mode_default: "false" },
      loaded: true,
    });

    render(
      <ArticlePane
        article={{ ...primaryArticle, url: "" }}
        feed={{ ...primaryFeed, reader_mode: "on", web_preview_mode: "on" }}
        feedName="Tech Blog"
      />,
      { wrapper: createWrapper() },
    );

    await screen.findByText("This article does not support web preview");

    expect(screen.getByTestId("article-reader-body")).toHaveClass("min-h-0");
    expect(screen.getByTestId("article-reader-body")).toHaveClass("flex-1");
    expect(screen.getByTestId("article-reader-scroll-area")).toHaveClass("h-full");
  });

  it("renders the subscriptions index page instead of the reader when the subscriptions workspace is open", async () => {
    useUiStore.setState({
      ...useUiStore.getInitialState(),
      selectedAccountId: "acc-1",
      selection: { type: "feed", feedId: "feed-1" },
      selectedArticleId: "art-1",
      contentMode: "reader",
      subscriptionsWorkspace: { kind: "index", cleanupContext: null },
    });

    render(<ArticleView />, { wrapper: createWrapper() });

    expect(await screen.findByRole("heading", { name: "Subscriptions" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 1, name: "First Article" })).not.toBeInTheDocument();
  });

  it("renders the share menu button when an article is selected", async () => {
    useUiStore.getState().selectAccount("acc-1");
    useUiStore.getState().selectFeed("feed-1");
    useUiStore.getState().selectArticle("art-1");

    render(<ArticleView />, { wrapper: createWrapper() });

    const shareButton = (await screen.findAllByRole("button", { name: "Share" }))[0];
    expect(shareButton).toBeInTheDocument();
    expect(shareButton).toBeEnabled();
    expect(shareButton).toHaveClass("size-11", "md:size-8", "rounded-lg", "text-muted-foreground");
  });

  it("disables the share menu button when no article is selected", async () => {
    useUiStore.getState().selectAccount("acc-1");
    useUiStore.getState().selectFeed("feed-1");

    render(<ArticleView />, { wrapper: createWrapper() });

    await waitFor(() => {
      const shareButton = screen.getAllByRole("button", { name: "Share" })[0];
      expect(shareButton).toBeDisabled();
    });
  });

  it(
    "hides reading list action when platform does not support it",
    async () => {
      const user = userEvent.setup();
      render(
        <ArticleToolbar
          article={primaryArticle ?? null}
          isBrowserOpen={false}
          onCloseView={() => {}}
          onToggleBrowserOverlay={() => {}}
        />,
        { wrapper: createWrapper() },
      );

      await user.click(await screen.findByRole("button", { name: "Share" }, ciWaitOptions));
      await screen.findByRole("menuitem", { name: "Copy link" }, ciWaitOptions);

      expect(screen.queryByRole("menuitem", { name: "Add to Reading List" })).not.toBeInTheDocument();
    },
    readingListTestTimeout,
  );

  it(
    "shows reading list action when platform supports it",
    async () => {
      setReadingListPlatformSupport(true);

      const user = userEvent.setup();
      render(
        <ArticleToolbar
          article={primaryArticle ?? null}
          isBrowserOpen={false}
          onCloseView={() => {}}
          onToggleBrowserOverlay={() => {}}
        />,
        { wrapper: createWrapper() },
      );

      await user.click(await screen.findByRole("button", { name: "Share" }, ciWaitOptions));
      await screen.findByRole("menuitem", { name: "Copy link" }, ciWaitOptions);

      expect(await screen.findByRole("menuitem", { name: "Add to Reading List" }, ciWaitOptions)).toBeInTheDocument();
    },
    readingListTestTimeout,
  );

  it(
    "does not invoke add to reading list from keyboard shortcut when unsupported",
    async () => {
      const calls: MockTauriCommandCall[] = [];
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

      if (!primaryArticle) {
        throw new Error("primaryArticle fixture is missing");
      }

      render(<ArticlePane article={primaryArticle} feed={primaryFeed} feedName="Feed One" />, {
        wrapper: createWrapper(),
      });

      calls.length = 0;
      fireEvent(window, new Event(keyboardEvents.addToReadingList));
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(calls).not.toContainEqual({
        cmd: "add_to_reading_list",
        args: { url: "https://example.com/1" },
      });
    },
    readingListTestTimeout,
  );

  it(
    "invokes add to reading list from keyboard shortcut when supported",
    async () => {
      const calls: MockTauriCommandCall[] = [];
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
      setReadingListPlatformSupport(true);
      if (!primaryArticle) {
        throw new Error("primaryArticle fixture is missing");
      }

      render(<ArticlePane article={primaryArticle} feed={primaryFeed} feedName="Feed One" />, {
        wrapper: createWrapper(),
      });

      calls.length = 0;
      fireEvent(window, new Event(keyboardEvents.addToReadingList));

      await waitFor(() => {
        expect(calls).toContainEqual({
          cmd: "add_to_reading_list",
          args: { url: "https://example.com/1" },
        });
      }, ciWaitOptions);
    },
    readingListTestTimeout,
  );
});
