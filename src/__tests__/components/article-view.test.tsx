import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { flushMicrotasksAndRealTimer } from "@tests/helpers/async-flush";
import { createWrapper } from "@tests/helpers/create-wrapper";
import { sampleAccounts, sampleArticles, sampleFeeds, sampleTags } from "@tests/helpers/fixtures";
import {
  listSampleArticlesByAccountId,
  listSampleArticlesByFeedId,
  listSampleArticlesByTagId,
  listSampleFeedsByAccountId,
  requireSampleArticle,
  requireSampleFeed,
} from "@tests/helpers/reader-fixtures";
import { setupTauriMocks } from "@tests/helpers/tauri-mocks";
import type { MockTauriCommandCall } from "@tests/helpers/tauri-types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ArticlePane, ArticleToolbar, ArticleView } from "@/components/reader/article-view";
import { readerPassiveCardOffsetClassName } from "@/components/reader/reader-passive-card";
import { BROWSER_OVERLAY_CLOSE_DELAY_MS, MOTION_ARTICLE_SLIDE_CLASS_NAME } from "@/constants/motion";
import { keyboardEvents } from "@/lib/keyboard/keyboard-shortcuts";
import { usePlatformStore } from "@/stores/platform-store";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";

vi.mock("@/dev/use-resolved-dev-intent", () => ({
  useResolvedDevIntent: () => ({
    intent: null,
    ready: true,
  }),
}));

const ciWaitOptions = { timeout: 20_000 };
const readingListTestTimeout = 30_000;
const primaryArticle = requireSampleArticle("art-1");
const primaryFeed = requireSampleFeed("feed-1");
const autoMarkArticleReadCall = {
  cmd: "mark_article_read",
  args: { articleId: "art-1", read: true },
} as const satisfies MockTauriCommandCall;

function requirePrimaryArticlePaneProps() {
  if (!primaryArticle || !primaryFeed) {
    throw new Error("primary article fixtures are missing");
  }

  return {
    article: primaryArticle,
    feed: primaryFeed,
    feedName: "Feed One",
  } as const;
}

function setupAutoMarkMocks(calls: MockTauriCommandCall[]) {
  setupTauriMocks((cmd, args) => {
    calls.push({ cmd, args });

    switch (cmd) {
      case "list_articles":
        return listSampleArticlesByFeedId(args.feedId);
      case "list_feeds":
        return listSampleFeedsByAccountId(args.accountId);
      case "list_tags":
        return [];
      case "get_article_tags":
      case "mark_article_read":
        return null;
      default:
        return undefined;
    }
  });
}

function setupArticleViewRecordingMocks(calls: MockTauriCommandCall[]) {
  setupTauriMocks((cmd, args) => {
    calls.push({ cmd, args });

    switch (cmd) {
      case "get_article_tags":
        return [];
      case "record_article_view":
        return null;
      default:
        return undefined;
    }
  });
}

function expectSummaryMetricMotionValue(summary: HTMLElement, label: string, value: string) {
  const labelNode = within(summary).getByText(new RegExp(`^${label}$`, "i"));
  const row = labelNode.closest("div");

  if (!row) {
    throw new Error(`Summary metric row was not found for ${label}`);
  }

  expect(within(row).getByText(value)).toHaveClass("motion-content-swap", "tabular-nums");
}

function expectSummaryLeadingVisual(summary: HTMLElement, expectedClassName: string) {
  const leadingVisual = within(summary).getByTestId("feed-detail-leading-visual");
  const visual = leadingVisual.firstElementChild;

  if (!(visual instanceof HTMLElement || visual instanceof SVGElement)) {
    throw new Error("Summary leading visual was not rendered");
  }

  expect(leadingVisual).toHaveClass("size-10");
  expect(visual).toHaveClass(expectedClassName);
}

async function expectArticleAutoMarksAsRead({
  afterReading,
  delayMs,
}: {
  afterReading: "after_0_3s" | "after_0_5s" | "after_1s";
  delayMs: number;
}) {
  vi.useFakeTimers();

  try {
    const calls: MockTauriCommandCall[] = [];
    setupAutoMarkMocks(calls);

    usePreferencesStore.setState({
      prefs: { after_reading: afterReading },
      loaded: true,
    });

    render(<ArticlePane {...requirePrimaryArticlePaneProps()} />, {
      wrapper: createWrapper(),
    });

    expect(calls).not.toContainEqual(autoMarkArticleReadCall);

    await vi.advanceTimersByTimeAsync(delayMs - 1);
    expect(calls).not.toContainEqual(autoMarkArticleReadCall);

    await vi.advanceTimersByTimeAsync(1);
    await Promise.resolve();
    await Promise.resolve();

    const markCalls = calls.filter(
      (call) =>
        call.cmd === autoMarkArticleReadCall.cmd &&
        call.args.articleId === autoMarkArticleReadCall.args.articleId &&
        call.args.read === autoMarkArticleReadCall.args.read,
    );
    expect(markCalls).toHaveLength(1);
  } finally {
    vi.useRealTimers();
  }
}

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

function listAccountFeedsWithFeedOneModes({
  accountId,
  readerMode,
  webPreviewMode,
}: {
  accountId: string | undefined;
  readerMode: "on" | "off";
  webPreviewMode: "on" | "off";
}) {
  const feeds: (typeof sampleFeeds)[number][] = [];

  for (const feed of sampleFeeds) {
    if (feed.account_id !== accountId) {
      continue;
    }

    feeds.push(feed.id === "feed-1" ? { ...feed, reader_mode: readerMode, web_preview_mode: webPreviewMode } : feed);
  }

  return feeds;
}

function listAccountFeedsInFolder(accountId: string, folderId: string) {
  const feeds: (typeof sampleFeeds)[number][] = [];

  for (const feed of sampleFeeds) {
    if (feed.account_id === accountId) {
      feeds.push({ ...feed, folder_id: folderId });
    }
  }

  return feeds;
}

function listOffSourceArticlesExcept(articleId: string) {
  const articles: (typeof sampleArticles)[number][] = [];

  for (const article of sampleArticles) {
    if (article.id !== articleId) {
      articles.push({ ...article, id: `${article.id}-off-source` });
    }
  }

  return articles;
}

function getArticleReaderViewport() {
  const viewport = screen
    .getByTestId("article-reader-scroll-area")
    .querySelector<HTMLElement>('[data-slot="scroll-area-viewport"]');
  if (!viewport) {
    throw new Error("Expected article reader viewport");
  }
  return viewport;
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
          return listSampleArticlesByFeedId(args.feedId);
        case "list_account_articles":
          return listSampleArticlesByAccountId(args.accountId);
        case "list_feeds":
          return listAccountFeedsWithFeedOneModes({
            accountId: args.accountId,
            readerMode: "on",
            webPreviewMode: "on",
          });
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
          return listSampleArticlesByFeedId(args.feedId);
        case "list_account_articles":
          return listSampleArticlesByAccountId(args.accountId);
        case "list_feeds":
          return listAccountFeedsWithFeedOneModes({
            accountId: args.accountId,
            readerMode: "on",
            webPreviewMode: "off",
          });
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

  it("records article views outside the recent smart view", async () => {
    const calls: MockTauriCommandCall[] = [];
    setupArticleViewRecordingMocks(calls);

    render(<ArticlePane {...requirePrimaryArticlePaneProps()} />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(calls).toContainEqual({
        cmd: "record_article_view",
        args: { accountId: "acc-1", articleId: "art-1" },
      });
    }, ciWaitOptions);
  });

  it("does not reorder recent smart view by recording the selected article again", async () => {
    const calls: MockTauriCommandCall[] = [];
    setupArticleViewRecordingMocks(calls);
    useUiStore.setState({
      selectedAccountId: "acc-1",
      selection: { type: "smart", kind: "recent" },
      selectedArticleId: "art-1",
      contentMode: "reader",
    });

    render(<ArticlePane {...requirePrimaryArticlePaneProps()} />, {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(screen.getByTestId("article-pane")).toBeInTheDocument(), ciWaitOptions);
    await Promise.resolve();
    await Promise.resolve();

    expect(calls.filter((call) => call.cmd === "record_article_view")).toHaveLength(0);
  });

  it("opens the web preview from the article title when open_links is in_app", async () => {
    const calls: MockTauriCommandCall[] = [];
    setupTauriMocks((cmd, args) => {
      calls.push({ cmd, args });

      switch (cmd) {
        case "list_articles":
          return listSampleArticlesByFeedId(args.feedId);
        case "list_feeds":
          return listSampleFeedsByAccountId(args.accountId);
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
    usePreferencesStore.setState({
      prefs: { open_links: "in_app" },
      loaded: true,
    });

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

    expect(screen.getByTestId("article-pane")).toHaveClass("typography-lane-reader");
    calls.length = 0;
    fireEvent.click(screen.getByRole("link", { name: "Read more" }));

    await waitFor(() => {
      expect(calls).toContainEqual({
        cmd: "open_in_browser",
        args: { url: "https://example.com/from-content", background: false },
      });
    });
  });

  it("resolves relative sanitized article links against the article URL before opening externally", async () => {
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
          url: "https://example.com/posts/current",
          content_sanitized: '<p><a href="../from-content?x=1#section">Read more</a></p>',
        }}
        feed={primaryFeed}
        feedName="Feed One"
      />,
      { wrapper: createWrapper() },
    );

    calls.length = 0;
    fireEvent.click(screen.getByRole("link", { name: "Read more" }));

    await waitFor(() => {
      expect(calls).toContainEqual({
        cmd: "open_in_browser",
        args: {
          url: "https://example.com/from-content?x=1#section",
          background: false,
        },
      });
    });
  });

  it("rejects mailto sanitized article links before invoking the external browser", async () => {
    const calls: MockTauriCommandCall[] = [];
    setupTauriMocks((cmd, args) => {
      calls.push({ cmd, args });

      switch (cmd) {
        case "list_tags":
          return [];
        case "get_article_tags":
          return [];
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
          content_sanitized: '<p><a href="mailto:hello@example.com">Email author</a></p>',
        }}
        feed={primaryFeed}
        feedName="Feed One"
      />,
      { wrapper: createWrapper() },
    );

    calls.length = 0;
    expect(screen.getByText("Email author")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Email author" })).not.toBeInTheDocument();

    expect(calls.filter(({ cmd }) => cmd === "open_in_browser")).toHaveLength(0);
    expect(useUiStore.getState().toastMessage).toBeNull();
  });

  it("keeps the embedded browser preview toggle available when action_open_browser is false", async () => {
    const calls: MockTauriCommandCall[] = [];
    setupTauriMocks((cmd, args) => {
      calls.push({ cmd, args });

      switch (cmd) {
        case "list_articles":
          return listSampleArticlesByFeedId(args.feedId);
        case "list_account_articles":
          return listSampleArticlesByAccountId(args.accountId);
        case "list_feeds":
          return listSampleFeedsByAccountId(args.accountId);
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
    usePreferencesStore.setState({
      prefs: { action_open_browser: "false" },
      loaded: true,
    });

    render(<ArticleView />, { wrapper: createWrapper() });

    calls.length = 0;

    expect(screen.queryByText("S")).not.toBeInTheDocument();
    expect(screen.queryByText("P")).not.toBeInTheDocument();

    const openBrowserButton = await screen.findByRole("button", {
      name: "Open Web Preview",
    });
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
          return listSampleArticlesByFeedId(args.feedId);
        case "list_account_articles":
          return listSampleArticlesByAccountId(args.accountId);
        case "list_feeds":
          return listSampleFeedsByAccountId(args.accountId);
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
          return listSampleArticlesByFeedId(args.feedId);
        case "list_account_articles":
          return listSampleArticlesByAccountId(args.accountId);
        case "list_feeds":
          return listSampleFeedsByAccountId(args.accountId);
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
      within(screen.getByTestId("browser-overlay-chrome")).getByRole("button", {
        name: "Close Web Preview",
      }),
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId("browser-overlay-chrome")).getByRole("button", {
        name: "Back to Reader",
      }),
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId("browser-overlay-chrome")).getByRole("button", {
        name: "Web forward",
      }),
    ).toBeInTheDocument();
    expect(within(overlayActions).getByRole("button", { name: "Reload page" })).toBeInTheDocument();
    expect(
      within(overlayActions).getByRole("button", {
        name: "Open in External Browser",
      }),
    ).toBeInTheDocument();
    expect(within(overlayActions).getByRole("button", { name: "Copy link" })).toBeInTheDocument();
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
          return listSampleArticlesByFeedId(args.feedId);
        case "list_account_articles":
          return listSampleArticlesByAccountId(args.accountId);
        case "list_feeds":
          return listSampleFeedsByAccountId(args.accountId);
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
    useUiStore.setState({ contentMode: "reader", browserUrl: null });

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
          return listSampleArticlesByFeedId(args.feedId);
        case "list_account_articles":
          return listSampleArticlesByAccountId(args.accountId);
        case "list_feeds":
          return listSampleFeedsByAccountId(args.accountId);
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

    const openBrowserButton = await screen.findByRole("button", {
      name: "Open Web Preview",
    });
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
          return listSampleArticlesByFeedId(args.feedId);
        case "list_account_articles":
          return listSampleArticlesByAccountId(args.accountId);
        case "list_feeds":
          return listSampleFeedsByAccountId(args.accountId);
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

    const openBrowserButton = await screen.findByRole("button", {
      name: "Open Web Preview",
    });
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
          return listSampleArticlesByFeedId(args.feedId);
        case "list_account_articles":
          return listSampleArticlesByAccountId(args.accountId);
        case "list_feeds":
          return listSampleFeedsByAccountId(args.accountId);
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

    const openBrowserButton = await screen.findByRole("button", {
      name: "Open Web Preview",
    });
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
          return listSampleArticlesByFeedId(args.feedId);
        case "list_account_articles":
          return listSampleArticlesByAccountId(args.accountId);
        case "list_feeds":
          return listSampleFeedsByAccountId(args.accountId);
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
          return new Promise<null>((resolve) => {
            resolveClose = () => resolve(null);
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

    vi.useFakeTimers();
    try {
      window.dispatchEvent(new Event(keyboardEvents.closeBrowserOverlay));

      expect(useUiStore.getState().contentMode).toBe("browser");
      expect(useUiStore.getState().browserUrl).toBe("https://example.com/1");

      resolveClose?.();

      await vi.advanceTimersByTimeAsync(BROWSER_OVERLAY_CLOSE_DELAY_MS - 1);
      expect(useUiStore.getState().contentMode).toBe("browser");
      expect(useUiStore.getState().browserUrl).toBe("https://example.com/1");

      await vi.advanceTimersByTimeAsync(1);

      expect(useUiStore.getState().contentMode).toBe("reader");
      expect(useUiStore.getState().browserUrl).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("opens the external browser from the article title when open_links is default_browser", async () => {
    const calls: MockTauriCommandCall[] = [];
    setupTauriMocks((cmd, args) => {
      calls.push({ cmd, args });

      switch (cmd) {
        case "list_articles":
          return listSampleArticlesByFeedId(args.feedId);
        case "list_feeds":
          return listSampleFeedsByAccountId(args.accountId);
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
    usePreferencesStore.setState({
      prefs: { open_links: "default_browser" },
      loaded: true,
    });

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
          return listSampleArticlesByFeedId(args.feedId);
        case "list_account_articles":
          return listSampleArticlesByAccountId(args.accountId);
        case "list_feeds":
          return listSampleFeedsByAccountId(args.accountId);
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
    usePreferencesStore.setState({
      prefs: { open_links: "in_app" },
      loaded: true,
    });

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
      expect(useUiStore.getState().selection).toEqual({
        type: "feed",
        feedId: "feed-1",
      });
      expect(useUiStore.getState().contentMode).toBe("empty");
    });
  });

  it("opens the external browser from the article title on modifier click", async () => {
    const calls: MockTauriCommandCall[] = [];
    setupTauriMocks((cmd, args) => {
      calls.push({ cmd, args });

      switch (cmd) {
        case "list_articles":
          return listSampleArticlesByFeedId(args.feedId);
        case "list_feeds":
          return listSampleFeedsByAccountId(args.accountId);
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
    usePreferencesStore.setState({
      prefs: { open_links: "in_app" },
      loaded: true,
    });

    render(<ArticleView />, { wrapper: createWrapper() });

    const titleButton = await screen.findByRole("button", {
      name: "First Article",
    });
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
          return listSampleArticlesByFeedId(args.feedId);
        case "list_feeds":
          return listSampleFeedsByAccountId(args.accountId);
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
    usePreferencesStore.setState({
      prefs: { open_links: "in_app" },
      loaded: true,
    });

    render(<ArticleView />, { wrapper: createWrapper() });

    const titleButton = await screen.findByRole("button", {
      name: "First Article",
    });
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
          return listSampleArticlesByFeedId(args.feedId);
        case "list_account_articles":
          return listSampleArticlesByAccountId(args.accountId);
        case "list_feeds":
          return listAccountFeedsWithFeedOneModes({
            accountId: args.accountId,
            readerMode: "on",
            webPreviewMode: "off",
          });
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
          return listSampleArticlesByFeedId(args.feedId);
        case "list_account_articles":
          return listSampleArticlesByAccountId(args.accountId);
        case "list_feeds":
          return listAccountFeedsWithFeedOneModes({
            accountId: args.accountId,
            readerMode: "on",
            webPreviewMode: "off",
          });
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
          return listSampleArticlesByFeedId(args.feedId);
        case "list_account_articles":
          return listSampleArticlesByAccountId(args.accountId);
        case "list_feeds":
          return listAccountFeedsWithFeedOneModes({
            accountId: args.accountId,
            readerMode: "on",
            webPreviewMode: "off",
          });
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
      expect(useUiStore.getState().toastMessage).toEqual({
        message: "Could not launch browser",
      });
    });
  });

  it("uses the close button as UI navigation back from the reader", async () => {
    setupTauriMocks((cmd, args) => {
      switch (cmd) {
        case "list_articles":
          return listSampleArticlesByFeedId(args.feedId);
        case "list_account_articles":
          return listSampleArticlesByAccountId(args.accountId);
        case "list_feeds":
          return listAccountFeedsWithFeedOneModes({
            accountId: args.accountId,
            readerMode: "on",
            webPreviewMode: "off",
          });
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

  it("does not auto-mark the article as read when after_reading is never", async () => {
    const calls: MockTauriCommandCall[] = [];
    setupTauriMocks((cmd, args) => {
      calls.push({ cmd, args });

      switch (cmd) {
        case "list_articles":
          return listSampleArticlesByFeedId(args.feedId);
        case "list_feeds":
          return listSampleFeedsByAccountId(args.accountId);
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
      prefs: { after_reading: "never" },
      loaded: true,
    });

    render(<ArticleView />, { wrapper: createWrapper() });

    await screen.findByRole("heading", { level: 1, name: "First Article" });

    expect(calls).not.toContainEqual({
      cmd: "mark_article_read",
      args: { articleId: "art-1", read: true },
    });
  });

  it("auto-marks the selected article as read immediately only once", async () => {
    const calls: MockTauriCommandCall[] = [];
    setupTauriMocks((cmd, args) => {
      calls.push({ cmd, args });

      switch (cmd) {
        case "list_articles":
          return listSampleArticlesByFeedId(args.feedId);
        case "list_feeds":
          return listSampleFeedsByAccountId(args.accountId);
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
      prefs: { after_reading: "immediately" },
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

  it("auto-marks the selected article as read after 0.3 seconds", async () => {
    await expectArticleAutoMarksAsRead({
      afterReading: "after_0_3s",
      delayMs: 300,
    });
  });

  it("auto-marks the selected article as read after 0.5 seconds", async () => {
    await expectArticleAutoMarksAsRead({
      afterReading: "after_0_5s",
      delayMs: 500,
    });
  });

  it("auto-marks the selected article as read after one second", async () => {
    await expectArticleAutoMarksAsRead({
      afterReading: "after_1s",
      delayMs: 1000,
    });
  });

  it("does not auto-mark the article as read when unmounted before one second", async () => {
    vi.useFakeTimers();

    if (!primaryArticle) {
      throw new Error("primaryArticle fixture is missing");
    }

    const calls: MockTauriCommandCall[] = [];
    setupTauriMocks((cmd, args) => {
      calls.push({ cmd, args });

      switch (cmd) {
        case "list_articles":
          return listSampleArticlesByFeedId(args.feedId);
        case "list_feeds":
          return listSampleFeedsByAccountId(args.accountId);
        case "list_tags":
          return [];
        case "get_article_tags":
          return [];
        default:
          return undefined;
      }
    });

    usePreferencesStore.setState({
      prefs: { after_reading: "after_1s" },
      loaded: true,
    });

    const { unmount } = render(<ArticlePane article={primaryArticle} feed={primaryFeed} feedName="Feed One" />, {
      wrapper: createWrapper(),
    });
    unmount();

    await vi.advanceTimersByTimeAsync(1000);

    expect(calls).not.toContainEqual({
      cmd: "mark_article_read",
      args: { articleId: "art-1", read: true },
    });
    vi.useRealTimers();
  });

  it("retains an auto-marked article in unread view before the delayed read mutation resolves", async () => {
    vi.useFakeTimers();

    if (!primaryArticle) {
      throw new Error("primaryArticle fixture is missing");
    }

    setupTauriMocks((cmd, args) => {
      switch (cmd) {
        case "list_articles":
          return listSampleArticlesByFeedId(args.feedId);
        case "list_feeds":
          return listSampleFeedsByAccountId(args.accountId);
        case "list_tags":
          return [];
        case "get_article_tags":
          return [];
        case "mark_article_read":
          return new Promise(() => {
            // Keep the mutation pending to verify that retention happens when auto-mark fires.
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
      prefs: { after_reading: "after_1s" },
      loaded: true,
    });

    render(<ArticlePane article={primaryArticle} feed={primaryFeed} feedName="Feed One" />, {
      wrapper: createWrapper(),
    });
    await vi.advanceTimersByTimeAsync(1000);
    await Promise.resolve();
    await Promise.resolve();

    expect(useUiStore.getState().retainedArticleIds).toEqual(new Set(["art-1"]));
    vi.useRealTimers();
  });

  it("keeps the selected article visible in browser mode after unread auto-mark removes it from the unread source", async () => {
    if (!primaryArticle || !primaryFeed) {
      throw new Error("primary fixtures are missing");
    }

    let articlesState = sampleArticles.map((article) => ({ ...article }));

    setupTauriMocks((cmd, args) => {
      switch (cmd) {
        case "list_articles":
          return articlesState.filter(
            (article) => article.feed_id === args.feedId && (!args.unreadOnly || !article.is_read),
          );
        case "list_feeds":
          return listAccountFeedsWithFeedOneModes({
            accountId: args.accountId,
            readerMode: "on",
            webPreviewMode: "on",
          });
        case "list_tags":
        case "get_article_tags":
          return [];
        case "mark_article_read":
          articlesState = articlesState.map((article) =>
            article.id === args.articleId ? { ...article, is_read: Boolean(args.read) } : article,
          );
          return null;
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
      contentMode: "browser",
      browserUrl: "https://example.com/1",
      viewMode: "unread",
    });
    usePreferencesStore.setState({
      prefs: { after_reading: "immediately" },
      loaded: true,
    });

    render(<ArticleView />, { wrapper: createWrapper() });

    expect(await screen.findByRole("button", { name: "Close Web Preview" })).toBeInTheDocument();

    await waitFor(() => {
      expect(useUiStore.getState().retainedArticleIds).toEqual(new Set(["art-1"]));
      expect(useUiStore.getState().contentMode).toBe("browser");
      expect(screen.queryByText("Article not found")).not.toBeInTheDocument();
    });
  });

  it("auto opens browser mode for all-items selection when the current feed enables web preview", async () => {
    setupTauriMocks((cmd, args) => {
      switch (cmd) {
        case "list_account_articles":
          return sampleArticles;
        case "list_feeds":
          return listAccountFeedsWithFeedOneModes({
            accountId: args.accountId,
            readerMode: "on",
            webPreviewMode: "on",
          });
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
    expect(screen.queryByText("Select an article")).not.toBeInTheDocument();
    expect(useUiStore.getState().contentMode).toBe("browser");
    expect(useUiStore.getState().browserUrl).toBe(previewUrl);
  });

  it("keeps browser preview visible when the selected article can no longer be resolved", async () => {
    const previewUrl = "https://example.com/1";

    setupTauriMocks((cmd, args) => {
      switch (cmd) {
        case "list_articles":
          return [];
        case "list_account_articles":
          return [];
        case "list_feeds":
          return listAccountFeedsWithFeedOneModes({
            accountId: args.accountId,
            readerMode: "on",
            webPreviewMode: "on",
          });
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
      contentMode: "browser",
      browserUrl: previewUrl,
      viewMode: "unread",
    });

    render(<ArticleView />, { wrapper: createWrapper() });

    expect(await screen.findByRole("button", { name: "Close Web Preview" })).toBeInTheDocument();
    expect(screen.queryByText("Article not found")).not.toBeInTheDocument();
  });

  it("keeps browser preview available for unread smart-view selections that only exist in the unread query source", async () => {
    const previewUrl = "https://example.com/1";
    const offSourceArticles = listOffSourceArticlesExcept("art-1");

    setupTauriMocks((cmd, args) => {
      switch (cmd) {
        case "list_account_articles":
          return args.unreadOnly ? sampleArticles.filter((article) => article.id === "art-1") : offSourceArticles;
        case "list_feeds":
          return listAccountFeedsWithFeedOneModes({
            accountId: args.accountId,
            readerMode: "on",
            webPreviewMode: "on",
          });
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
      selection: { type: "smart", kind: "unread" },
      selectedArticleId: "art-1",
      contentMode: "browser",
      browserUrl: previewUrl,
      viewMode: "unread",
    });

    render(<ArticleView />, { wrapper: createWrapper() });

    expect(await screen.findByRole("button", { name: "Close Web Preview" })).toBeInTheDocument();
    expect(screen.queryByText("Article not found")).not.toBeInTheDocument();
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
      expect(screen.getByText("Select an article")).toBeInTheDocument();
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
      expect(screen.getByText("Select an article")).toBeInTheDocument();
    });
  });

  it("renders the empty-state unread toggle without semantic unread tone", () => {
    render(<ArticleView />, { wrapper: createWrapper() });

    const readButton = screen.getByRole("button", { name: "Toggle read" });
    const readIcon = readButton.querySelector("span");

    expect(screen.getByText("Select an article")).toBeInTheDocument();
    expect(readButton).toBeDisabled();
    expect(readButton).toHaveAttribute("aria-pressed", "false");
    expect(readIcon).not.toBeNull();
    expect(readIcon).not.toHaveClass("bg-[var(--tone-unread)]");
    expect(readIcon).not.toHaveClass("text-[var(--tone-unread)]");
  });

  it("renders a feed summary card when a feed is selected without an article", async () => {
    useUiStore.setState({
      ...useUiStore.getInitialState(),
      selectedAccountId: "acc-1",
      selection: { type: "feed", feedId: "feed-1" },
      selectedArticleId: null,
      contentMode: "empty",
    });

    render(<ArticleView />, { wrapper: createWrapper() });

    const summary = await screen.findByTestId("article-selection-summary");
    expect(summary).toHaveClass(readerPassiveCardOffsetClassName);
    expect(
      within(summary).getByRole("heading", { level: 3, name: "Tech Blog" }).closest('[data-surface-card="section"]'),
    ).toHaveClass("rounded-3xl", "bg-card/38", "shadow-none", "dark:bg-card/38");
    expect(within(summary).getByRole("heading", { level: 3, name: "Tech Blog" })).toBeInTheDocument();
    expect(within(summary).getByText("Latest Article")).toBeInTheDocument();
    expect(within(summary).getByText("First Article")).toBeInTheDocument();
    expect(within(summary).getByText(/^(Latest Update|latest_update)/i)).toBeInTheDocument();
    expect(within(summary).getByText("example.com")).toBeInTheDocument();
    expect(within(summary).queryByRole("link", { name: "example.com" })).not.toBeInTheDocument();
    expect(screen.queryByText("Select an article")).not.toBeInTheDocument();
  });

  it("keeps the feed summary card stable when the selected feed has no articles", async () => {
    setupTauriMocks((cmd, args) => {
      switch (cmd) {
        case "list_accounts":
          return sampleAccounts;
        case "list_feeds":
          return listSampleFeedsByAccountId(args.accountId);
        case "list_articles":
          return [];
        case "list_tags":
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
      selectedArticleId: null,
      contentMode: "empty",
    });

    render(<ArticleView />, { wrapper: createWrapper() });

    const summary = await screen.findByTestId("article-selection-summary");
    expect(within(summary).getByRole("heading", { level: 3, name: "Tech Blog" })).toBeInTheDocument();
    expect(within(summary).getAllByText("—").length).toBeGreaterThan(0);
    expect(screen.queryByText("Select an article")).not.toBeInTheDocument();
  });

  it("renders a folder summary card when a folder is selected without an article", async () => {
    setupTauriMocks((cmd, args) => {
      switch (cmd) {
        case "list_accounts":
          return sampleAccounts;
        case "list_folders":
          return [
            {
              id: "folder-1",
              account_id: "acc-1",
              name: "Gaming",
              sort_order: 0,
            },
          ];
        case "list_feeds":
          return listAccountFeedsInFolder(args.accountId, "folder-1");
        case "list_account_articles":
          return sampleArticles;
        case "list_folder_articles":
          return sampleArticles;
        case "list_tags":
        case "get_article_tags":
          return [];
        default:
          return undefined;
      }
    });

    useUiStore.setState({
      ...useUiStore.getInitialState(),
      selectedAccountId: "acc-1",
      selection: { type: "folder", folderId: "folder-1" },
      selectedArticleId: null,
      contentMode: "empty",
    });

    render(<ArticleView />, { wrapper: createWrapper() });

    const summary = await screen.findByTestId("article-selection-summary");
    expect(within(summary).getByRole("heading", { level: 3, name: "Gaming" })).toBeInTheDocument();
    expectSummaryLeadingVisual(summary, "size-5");
    expectSummaryMetricMotionValue(summary, "Feeds", "1");
    expectSummaryMetricMotionValue(summary, "Unread", "1");
    expect(within(summary).getByText(/^(Latest Update|latest_update)/i)).toBeInTheDocument();
    expect(screen.queryByText("Select an article")).not.toBeInTheDocument();
  });

  it("renders a tag summary card when a tag is selected without an article", async () => {
    setupTauriMocks((cmd, args) => {
      switch (cmd) {
        case "list_accounts":
          return sampleAccounts;
        case "list_tags":
          return sampleTags;
        case "list_feeds":
          return listSampleFeedsByAccountId(args.accountId);
        case "list_articles_by_tag":
          return listSampleArticlesByTagId(args.tagId);
        case "get_article_tags":
          return [];
        default:
          return undefined;
      }
    });

    useUiStore.setState({
      ...useUiStore.getInitialState(),
      selectedAccountId: "acc-1",
      selection: { type: "tag", tagId: "tag-1" },
      selectedArticleId: null,
      viewMode: "all",
      contentMode: "empty",
    });

    render(<ArticleView />, { wrapper: createWrapper() });

    const summary = await screen.findByTestId("article-selection-summary");
    expect(within(summary).getByRole("heading", { level: 3, name: "Tech" })).toBeInTheDocument();
    expectSummaryLeadingVisual(summary, "size-3");
    expectSummaryMetricMotionValue(summary, "Articles", "1");
    expectSummaryMetricMotionValue(summary, "Feeds", "1");
    expect(within(summary).getByText(/^(Latest Update|latest_update)/i)).toBeInTheDocument();
  });

  it("renders an unread smart-view summary card when unread is selected without an article", async () => {
    useUiStore.setState({
      ...useUiStore.getInitialState(),
      selectedAccountId: "acc-1",
      selection: { type: "smart", kind: "unread" },
      selectedArticleId: null,
      contentMode: "empty",
    });

    render(<ArticleView />, { wrapper: createWrapper() });

    const summary = await screen.findByTestId("article-selection-summary");
    expect(within(summary).getByRole("heading", { level: 3, name: /^Unread$/i })).toBeInTheDocument();
    expectSummaryLeadingVisual(summary, "size-5");
    await waitFor(() => {
      expectSummaryMetricMotionValue(summary, "Articles", "1");
    });
    expect(within(summary).getByText("Feeds")).toBeInTheDocument();
    expect(within(summary).getByText(/^(Latest Update|latest_update)/i)).toBeInTheDocument();
  });

  it("renders a starred smart-view summary card when starred is selected without an article", async () => {
    useUiStore.setState({
      ...useUiStore.getInitialState(),
      selectedAccountId: "acc-1",
      selection: { type: "smart", kind: "starred" },
      selectedArticleId: null,
      contentMode: "empty",
      viewMode: "all",
    });

    render(<ArticleView />, { wrapper: createWrapper() });

    const summary = await screen.findByTestId("article-selection-summary");
    expect(within(summary).getByRole("heading", { level: 3, name: /^Starred$/i })).toBeInTheDocument();
    expectSummaryLeadingVisual(summary, "size-5");
    await waitFor(() => {
      expectSummaryMetricMotionValue(summary, "Articles", "1");
    });
    expect(within(summary).getByText("Feeds")).toBeInTheDocument();
    expect(within(summary).getByText("Latest Update")).toBeInTheDocument();
  });

  it("renders account setup guidance when no accounts are available", async () => {
    setupTauriMocks((cmd) => {
      switch (cmd) {
        case "list_accounts":
          return [];
        case "list_tags":
          return [];
        case "get_article_tags":
          return [];
        default:
          return undefined;
      }
    });

    render(<ArticleView />, { wrapper: createWrapper() });

    expect(await screen.findByText("Add your first account")).toBeInTheDocument();
    expect(screen.getByText("Add an account first to get subscriptions and sync ready.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add account…" })).toBeInTheDocument();
    expect(screen.queryByText("Select an article")).not.toBeInTheDocument();
  });

  it("renders feed setup guidance when the selected account has no feeds", async () => {
    setupTauriMocks((cmd, _args) => {
      switch (cmd) {
        case "list_accounts":
          return sampleAccounts;
        case "list_feeds":
          return [];
        case "list_account_articles":
          return [];
        case "list_tags":
          return [];
        case "get_article_tags":
          return [];
        case "count_account_unread_articles":
        case "count_account_starred_articles":
          return 0;
        default:
          return undefined;
      }
    });

    useUiStore.setState({
      ...useUiStore.getInitialState(),
      selectedAccountId: "acc-1",
      selection: { type: "all" },
      contentMode: "empty",
    });

    render(<ArticleView />, { wrapper: createWrapper() });

    expect(await screen.findByText("Add your first feed")).toBeInTheDocument();
    expect(
      screen.getByText("Your account is ready. Add the first feed and the reading queue will come to life."),
    ).toBeInTheDocument();
    expect(screen.getByText("Use the + button in the top-left to add a feed.")).toBeInTheDocument();
    expect(screen.getByText("Paste a site URL or feed URL to discover feeds automatically.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add Feed" })).toBeInTheDocument();
    expect(screen.queryByText("Select an article")).not.toBeInTheDocument();
  });

  it("keeps intent and article-driven entries on the same minimal viewer shell", async () => {
    const user = userEvent.setup();

    setupTauriMocks((cmd, args) => {
      switch (cmd) {
        case "list_articles":
          return listSampleArticlesByFeedId(args.feedId);
        case "list_feeds":
          return listSampleFeedsByAccountId(args.accountId);
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
          return listSampleArticlesByFeedId(args.feedId);
        case "list_feeds":
          return listAccountFeedsWithFeedOneModes({
            accountId: args.accountId,
            readerMode: "on",
            webPreviewMode: "off",
          });
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
          return listSampleFeedsByAccountId(args.accountId);
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

    expect(await screen.findByText("Article not found")).toHaveClass("text-foreground-soft");
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

    const warning = await screen.findByText("This article does not support web preview");

    expect(screen.getByTestId("article-reader-body")).toHaveClass("min-h-0");
    expect(screen.getByTestId("article-reader-body")).toHaveClass("flex-1");
    expect(screen.getByTestId("article-reader-scroll-area")).toHaveClass("h-full");
    expect(
      screen.getByRole("heading", { level: 1, name: "First Article" }).closest('[data-slot="scroll-area-content"]'),
    ).toHaveClass("pr-3");
    expect(screen.getByTestId("article-reader-body").querySelector(".border-t")).toHaveClass("border-border/20");
    expect(warning).toHaveClass("bg-state-warning-surface", "text-state-warning-foreground");
  });

  it("scrolls the reader viewport with arrows, Space, and Shift+Space", async () => {
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
    const longArticle = {
      ...primaryArticle,
      content_sanitized: Array.from(
        { length: 16 },
        (_, index) =>
          `<p>Long reader keyboard test paragraph ${index + 1}. This paragraph keeps the article scrollable.</p>`,
      ).join(""),
    };

    render(<ArticlePane article={longArticle} feed={{ ...primaryFeed, reader_mode: "on" }} feedName="Tech Blog" />, {
      wrapper: createWrapper(),
    });

    await screen.findByRole("heading", { level: 1, name: "First Article" });
    const viewport = getArticleReaderViewport();
    Object.defineProperty(viewport, "clientHeight", {
      configurable: true,
      value: 500,
    });
    viewport.scrollTop = 0;

    fireEvent.keyDown(viewport, { key: "ArrowDown" });
    expect(viewport.scrollTop).toBe(400);

    fireEvent.keyDown(viewport, { key: "ArrowUp" });
    expect(viewport.scrollTop).toBe(0);

    fireEvent.keyDown(viewport, { key: " " });
    expect(viewport.scrollTop).toBe(400);

    fireEvent.keyDown(viewport, { key: " ", shiftKey: true });
    expect(viewport.scrollTop).toBe(0);
  });

  it("resets the reader viewport scroll position when the article changes", async () => {
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

    const { rerender } = render(
      <ArticlePane article={primaryArticle} feed={{ ...primaryFeed, reader_mode: "on" }} feedName="Tech Blog" />,
      { wrapper: createWrapper() },
    );

    await screen.findByRole("heading", { level: 1, name: "First Article" });
    const viewport = getArticleReaderViewport();
    viewport.scrollTop = 320;

    rerender(
      <ArticlePane
        article={{ ...primaryArticle, id: "art-next", title: "Next Article" }}
        feed={{ ...primaryFeed, reader_mode: "on" }}
        feedName="Tech Blog"
      />,
    );

    await screen.findByRole("heading", { level: 1, name: "Next Article" });
    expect(viewport.scrollTop).toBe(0);
  });

  it("marks the reader body with the next-article slide direction", async () => {
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
    useUiStore.setState({ articleNavigationDirection: 1 });

    render(<ArticlePane article={primaryArticle} feed={{ ...primaryFeed, reader_mode: "on" }} feedName="Tech Blog" />, {
      wrapper: createWrapper(),
    });

    await screen.findByRole("heading", { level: 1, name: "First Article" });
    expect(screen.getByTestId("article-reader-body")).toHaveClass(MOTION_ARTICLE_SLIDE_CLASS_NAME);
    expect(screen.getByTestId("article-reader-body")).toHaveAttribute("data-motion-direction", "next");
  });

  it("keeps article detail switching limited to the reader body slide contract", async () => {
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
    useUiStore.setState({ articleNavigationDirection: 1 });

    render(<ArticlePane article={primaryArticle} feed={{ ...primaryFeed, reader_mode: "on" }} feedName="Tech Blog" />, {
      wrapper: createWrapper(),
    });

    await screen.findByRole("heading", { level: 1, name: "First Article" });
    const readerBody = screen.getByTestId("article-reader-body");
    expect(readerBody).toHaveClass(MOTION_ARTICLE_SLIDE_CLASS_NAME);
    expect(readerBody).not.toHaveClass(
      "motion-content-swap",
      "motion-contextual-surface",
      "motion-interactive-surface",
      "motion-static-hover-surface",
    );
  });

  it("marks the reader body with the previous-article slide direction", async () => {
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
    useUiStore.setState({ articleNavigationDirection: -1 });

    render(<ArticlePane article={primaryArticle} feed={{ ...primaryFeed, reader_mode: "on" }} feedName="Tech Blog" />, {
      wrapper: createWrapper(),
    });

    await screen.findByRole("heading", { level: 1, name: "First Article" });
    expect(screen.getByTestId("article-reader-body")).toHaveClass(MOTION_ARTICLE_SLIDE_CLASS_NAME);
    expect(screen.getByTestId("article-reader-body")).toHaveAttribute("data-motion-direction", "prev");
  });

  it("uses the neutral article slide direction for direct selection", async () => {
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

    render(<ArticlePane article={primaryArticle} feed={{ ...primaryFeed, reader_mode: "on" }} feedName="Tech Blog" />, {
      wrapper: createWrapper(),
    });

    await screen.findByRole("heading", { level: 1, name: "First Article" });
    expect(screen.getByTestId("article-reader-body")).toHaveClass(MOTION_ARTICLE_SLIDE_CLASS_NAME);
    expect(screen.getByTestId("article-reader-body")).toHaveAttribute("data-motion-direction", "neutral");
  });

  it("renders the subscriptions index page instead of the reader when the subscriptions workspace is open", async () => {
    useUiStore.setState({
      ...useUiStore.getInitialState(),
      selectedAccountId: "acc-1",
      selection: { type: "feed", feedId: "feed-1" },
      selectedArticleId: "art-1",
      contentMode: "reader",
      subscriptionsWorkspace: { kind: "index" },
    });

    render(<ArticleView />, { wrapper: createWrapper() });

    expect(await screen.findByRole("heading", { name: "Subscriptions" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 1, name: "First Article" })).not.toBeInTheDocument();
  });

  it("renders the share menu button when an article is selected", async () => {
    render(
      <ArticleToolbar
        article={primaryArticle ?? null}
        isBrowserOpen={false}
        onCloseView={() => {}}
        onToggleBrowserOverlay={() => {}}
      />,
      { wrapper: createWrapper() },
    );

    const shareButton = (await screen.findAllByRole("button", { name: "Share" }))[0];
    expect(shareButton).toBeInTheDocument();
    expect(shareButton).toBeEnabled();
    expect(shareButton).toHaveClass("size-11", "md:size-8", "rounded-md", "text-foreground-soft");
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
            return listSampleArticlesByFeedId(args.feedId);
          case "list_account_articles":
            return listSampleArticlesByAccountId(args.accountId);
          case "list_feeds":
            return listSampleFeedsByAccountId(args.accountId);
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
      await flushMicrotasksAndRealTimer();

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
            return listSampleArticlesByFeedId(args.feedId);
          case "list_account_articles":
            return listSampleArticlesByAccountId(args.accountId);
          case "list_feeds":
            return listSampleFeedsByAccountId(args.accountId);
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
