import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TOAST_AUTO_DISMISS_TIMEOUT_MS } from "@/constants/ui-runtime";
import { useUiStore } from "../../stores/ui-store";

describe("useUiStore", () => {
  beforeEach(() => {
    useUiStore.setState(useUiStore.getInitialState());
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("initial state defaults", () => {
    const s = useUiStore.getState();
    expect(s.layoutMode).toBe("wide");
    expect(s.contentMode).toBe("empty");
    expect(s.selection).toEqual({ type: "all" });
    expect(s.commandPaletteOpen).toBe(false);
    expect(s.sidebarOpen).toBe(true);
    expect(s.accountPaneOpen).toBe(false);
  });

  it("openCommandPalette sets true", () => {
    useUiStore.getState().openCommandPalette();
    expect(useUiStore.getState().commandPaletteOpen).toBe(true);
  });

  it("closeCommandPalette sets false", () => {
    useUiStore.getState().openCommandPalette();
    useUiStore.getState().closeCommandPalette();
    expect(useUiStore.getState().commandPaletteOpen).toBe(false);
  });

  it("toggleCommandPalette toggles open state", () => {
    useUiStore.getState().toggleCommandPalette();
    expect(useUiStore.getState().commandPaletteOpen).toBe(true);
    useUiStore.getState().toggleCommandPalette();
    expect(useUiStore.getState().commandPaletteOpen).toBe(false);
  });

  it("opens and closes the subscriptions index workspace", () => {
    expect(useUiStore.getState().subscriptionsWorkspace).toBeNull();
    expect("feedCleanupOpen" in useUiStore.getState()).toBe(false);

    useUiStore.getState().openSubscriptionsIndex();
    expect(useUiStore.getState().subscriptionsWorkspace).toEqual({
      kind: "index",
    });
    expect(useUiStore.getState().focusedPane).toBe("content");
    expect("feedCleanupOpen" in useUiStore.getState()).toBe(false);

    useUiStore.getState().closeSubscriptionsWorkspace();
    expect(useUiStore.getState().subscriptionsWorkspace).toBeNull();
    expect("feedCleanupOpen" in useUiStore.getState()).toBe(false);
    expect(useUiStore.getState().focusedPane).toBe("list");
  });

  it("selectFeed updates selection", () => {
    useUiStore.getState().selectFeed("f1");
    expect(useUiStore.getState().selection).toEqual({ type: "feed", feedId: "f1" });
    expect(useUiStore.getState().selectedArticleId).toBeNull();
  });

  it("context-aware subscription selection returns to unread outside starred context", () => {
    useUiStore.setState({ viewMode: "all", selection: { type: "all" } });

    useUiStore.getState().selectFeedFromCurrentContext("feed-1");
    expect(useUiStore.getState().selection).toEqual({ type: "feed", feedId: "feed-1" });
    expect(useUiStore.getState().viewMode).toBe("unread");

    useUiStore.getState().selectFolderFromCurrentContext("folder-1");
    expect(useUiStore.getState().selection).toEqual({ type: "folder", folderId: "folder-1" });
    expect(useUiStore.getState().viewMode).toBe("unread");
    expect(useUiStore.getState().expandedFolderIds.has("folder-1")).toBe(true);

    useUiStore.getState().selectTagFromCurrentContext("tag-1");
    expect(useUiStore.getState().selection).toEqual({ type: "tag", tagId: "tag-1" });
    expect(useUiStore.getState().viewMode).toBe("unread");
  });

  it("context-aware subscription selection preserves starred context", () => {
    useUiStore.setState({ selection: { type: "smart", kind: "starred" }, viewMode: "all" });
    useUiStore.getState().selectFeedFromCurrentContext("feed-1");
    expect(useUiStore.getState().selection).toEqual({ type: "feed", feedId: "feed-1" });
    expect(useUiStore.getState().viewMode).toBe("starred");

    useUiStore.setState({ selection: { type: "all" }, viewMode: "starred" });
    useUiStore.getState().selectFolderFromCurrentContext("folder-1");
    expect(useUiStore.getState().selection).toEqual({ type: "folder", folderId: "folder-1" });
    expect(useUiStore.getState().viewMode).toBe("starred");

    useUiStore.setState({ selection: { type: "smart", kind: "starred" }, viewMode: "all" });
    useUiStore.getState().selectTagFromCurrentContext("tag-1");
    expect(useUiStore.getState().selection).toEqual({ type: "tag", tagId: "tag-1" });
    expect(useUiStore.getState().viewMode).toBe("starred");
  });

  it("keeps the current footer filter when selecting a feed", () => {
    useUiStore.getState().setViewMode("all");
    useUiStore.getState().selectFeed("f1");
    expect(useUiStore.getState().viewMode).toBe("all");

    useUiStore.getState().setViewMode("starred");
    useUiStore.getState().selectFeed("f2");
    expect(useUiStore.getState().viewMode).toBe("starred");
  });

  it("selectSmartView('unread') keeps unread as a complete smart view without footer filtering", () => {
    useUiStore.getState().setViewMode("starred");
    useUiStore.getState().selectSmartView("unread");

    expect(useUiStore.getState().selection).toEqual({ type: "smart", kind: "unread" });
    expect(useUiStore.getState().viewMode).toBe("unread");
  });

  it("selectSmartView('starred') selects the starred footer filter", () => {
    useUiStore.getState().setViewMode("starred");
    useUiStore.getState().selectSmartView("starred");

    expect(useUiStore.getState().selection).toEqual({ type: "smart", kind: "starred" });
    expect(useUiStore.getState().viewMode).toBe("starred");

    useUiStore.getState().setViewMode("all");
    useUiStore.getState().selectSmartView("starred");
    expect(useUiStore.getState().viewMode).toBe("starred");
  });

  it("selectSmartView('recent') selects the all footer filter", () => {
    useUiStore.getState().setViewMode("starred");
    useUiStore.getState().selectSmartView("recent");

    expect(useUiStore.getState().selection).toEqual({ type: "smart", kind: "recent" });
    expect(useUiStore.getState().viewMode).toBe("all");

    useUiStore.getState().setViewMode("unread");
    useUiStore.getState().selectSmartView("recent");
    expect(useUiStore.getState().viewMode).toBe("all");
  });

  it("keeps the current footer filter when changing list scopes", () => {
    useUiStore.getState().setViewMode("starred");
    useUiStore.getState().selectFolder("folder-1");
    expect(useUiStore.getState().viewMode).toBe("starred");

    useUiStore.getState().setViewMode("all");
    useUiStore.getState().selectTag("tag-1");
    expect(useUiStore.getState().viewMode).toBe("all");

    useUiStore.getState().setViewMode("starred");
    useUiStore.getState().selectAll();
    expect(useUiStore.getState().viewMode).toBe("starred");
  });

  it("selectArticle sets reader mode", () => {
    useUiStore.getState().selectArticle("a1");
    expect(useUiStore.getState().contentMode).toBe("reader");
    expect(useUiStore.getState().selectedArticleId).toBe("a1");
  });

  it("keeps selected articles retained in unread mode until the screen changes", () => {
    useUiStore.getState().retainArticle("art-1");
    useUiStore.getState().selectArticle("art-1");
    expect(useUiStore.getState().retainedArticleIds).toEqual(new Set(["art-1"]));

    useUiStore.getState().selectArticle("art-2");
    expect(useUiStore.getState().retainedArticleIds).toEqual(new Set(["art-1", "art-2"]));
  });

  it("does not change retained articles when selecting in all mode", () => {
    useUiStore.getState().setViewMode("all");
    useUiStore.getState().retainArticle("art-1");

    useUiStore.getState().selectArticle("art-2");

    expect(useUiStore.getState().retainedArticleIds).toEqual(new Set(["art-1"]));
  });

  it("openBrowser switches mode", () => {
    useUiStore.getState().openBrowser("https://ex.com");
    expect(useUiStore.getState().contentMode).toBe("browser");
    expect(useUiStore.getState().browserUrl).toBe("https://ex.com");
    expect(useUiStore.getState().focusedPane).toBe("content");
  });

  it("closeBrowser returns to reader if article selected", () => {
    useUiStore.getState().selectArticle("a1");
    useUiStore.getState().openBrowser("https://ex.com");
    useUiStore.getState().closeBrowser();
    expect(useUiStore.getState().contentMode).toBe("reader");
    expect(useUiStore.getState().focusedPane).toBe("content");
  });

  it("closeBrowser returns to the list when no article is selected", () => {
    useUiStore.getState().setFocusedPane("sidebar");
    useUiStore.getState().openBrowser("https://ex.com");
    useUiStore.getState().closeBrowser();

    expect(useUiStore.getState().contentMode).toBe("empty");
    expect(useUiStore.getState().browserUrl).toBeNull();
    expect(useUiStore.getState().focusedPane).toBe("list");
  });

  it("closeBrowser clears in-flight browser state and returns focus by article presence", () => {
    useUiStore.setState({
      selectedArticleId: "art-1",
      contentMode: "browser",
      browserUrl: "https://example.com",
      browserCloseInFlight: true,
      pendingBrowserCloseAction: "next-article",
      focusedPane: "sidebar",
    });

    useUiStore.getState().closeBrowser();

    expect(useUiStore.getState()).toEqual(
      expect.objectContaining({
        contentMode: "reader",
        browserUrl: null,
        browserNavigationState: null,
        browserCloseInFlight: false,
        pendingBrowserCloseAction: null,
        focusedPane: "content",
      }),
    );

    useUiStore.setState({
      selectedArticleId: null,
      contentMode: "browser",
      browserUrl: "https://example.com",
      browserCloseInFlight: true,
      pendingBrowserCloseAction: "next-article",
      focusedPane: "content",
    });

    useUiStore.getState().closeBrowser();

    expect(useUiStore.getState()).toEqual(
      expect.objectContaining({
        contentMode: "empty",
        browserUrl: null,
        browserNavigationState: null,
        browserCloseInFlight: false,
        pendingBrowserCloseAction: null,
        focusedPane: "list",
      }),
    );
  });

  it("toggleFolder adds and removes", () => {
    useUiStore.getState().toggleFolder("f1");
    expect(useUiStore.getState().expandedFolderIds.has("f1")).toBe(true);
    useUiStore.getState().toggleFolder("f1");
    expect(useUiStore.getState().expandedFolderIds.has("f1")).toBe(false);
  });

  it("focuses the list pane for list-oriented selections", () => {
    useUiStore.getState().setFocusedPane("sidebar");
    useUiStore.getState().selectAccount("acc-1");
    expect(useUiStore.getState().focusedPane).toBe("list");

    useUiStore.getState().setFocusedPane("sidebar");
    useUiStore.getState().selectFolder("folder-1");
    expect(useUiStore.getState().focusedPane).toBe("list");

    useUiStore.getState().setFocusedPane("sidebar");
    useUiStore.getState().selectSmartView("unread");
    expect(useUiStore.getState().focusedPane).toBe("list");

    useUiStore.getState().setFocusedPane("sidebar");
    useUiStore.getState().selectAll();
    expect(useUiStore.getState().focusedPane).toBe("list");
  });

  it("clears retained articles when the user changes the current screen", () => {
    useUiStore.getState().retainArticle("art-1");
    expect(useUiStore.getState().retainedArticleIds).toEqual(new Set(["art-1"]));

    useUiStore.getState().setViewMode("starred");
    expect(useUiStore.getState().retainedArticleIds).toEqual(new Set());

    useUiStore.getState().retainArticle("art-2");
    useUiStore.getState().selectFeed("feed-1");
    expect(useUiStore.getState().retainedArticleIds).toEqual(new Set());
  });

  it("toggleSidebar closes the wide sidebar and falls back to the content pane when needed", () => {
    useUiStore.setState({
      layoutMode: "wide",
      focusedPane: "sidebar",
      selectedArticleId: "art-1",
      contentMode: "reader",
    });

    useUiStore.getState().toggleSidebar();

    expect(useUiStore.getState().sidebarOpen).toBe(false);
    expect(useUiStore.getState().focusedPane).toBe("content");
  });

  it("openSidebar reopens the sidebar and focuses it", () => {
    useUiStore.setState({
      layoutMode: "wide",
      sidebarOpen: false,
      focusedPane: "content",
      selectedArticleId: "art-1",
      contentMode: "reader",
    });

    useUiStore.getState().openSidebar();

    expect(useUiStore.getState().sidebarOpen).toBe(true);
    expect(useUiStore.getState().focusedPane).toBe("sidebar");
  });

  it("opens, closes, and toggles the transient account pane", () => {
    useUiStore.getState().openAccountPane();
    expect(useUiStore.getState().accountPaneOpen).toBe(true);

    useUiStore.getState().toggleAccountPane();
    expect(useUiStore.getState().accountPaneOpen).toBe(false);

    useUiStore.getState().toggleAccountPane();
    expect(useUiStore.getState().accountPaneOpen).toBe(true);

    useUiStore.getState().closeAccountPane();
    expect(useUiStore.getState().accountPaneOpen).toBe(false);
  });

  it("closes the account pane when navigation leaves the account rail context", () => {
    useUiStore.setState({ accountPaneOpen: true });

    useUiStore.getState().selectAccount("acc-1");
    expect(useUiStore.getState().accountPaneOpen).toBe(false);

    useUiStore.setState({ accountPaneOpen: true, focusedPane: "sidebar" });
    useUiStore.getState().closeSidebar();
    expect(useUiStore.getState().accountPaneOpen).toBe(false);

    useUiStore.setState({ accountPaneOpen: true });
    useUiStore.getState().openSubscriptionsIndex();
    expect(useUiStore.getState().accountPaneOpen).toBe(false);
  });

  it("falls back the selected reader account when the current account is deleted", () => {
    useUiStore.setState({
      selectedAccountId: "acc-1",
      accountPaneOpen: true,
      selection: { type: "feed", feedId: "feed-1" },
      selectedArticleId: "article-1",
      contentMode: "reader",
      viewMode: "starred",
      focusedPane: "content",
      recentlyReadIds: new Set(["article-1"]),
      retainedArticleIds: new Set(["article-1"]),
    });

    useUiStore.getState().handleAccountDeleted("acc-1", ["acc-2"]);

    expect(useUiStore.getState().selectedAccountId).toBe("acc-2");
    expect(useUiStore.getState().accountPaneOpen).toBe(false);
    expect(useUiStore.getState().selection).toEqual({ type: "all" });
    expect(useUiStore.getState().selectedArticleId).toBeNull();
    expect(useUiStore.getState().contentMode).toBe("empty");
    expect(useUiStore.getState().viewMode).toBe("unread");
    expect(useUiStore.getState().focusedPane).toBe("list");
    expect(useUiStore.getState().recentlyReadIds).toEqual(new Set());
    expect(useUiStore.getState().retainedArticleIds).toEqual(new Set());

    useUiStore.getState().handleAccountDeleted("acc-2", []);

    expect(useUiStore.getState().selectedAccountId).toBeNull();
    expect(useUiStore.getState().focusedPane).toBe("sidebar");
  });

  it("falls back settings account detail without changing an unrelated reader selection", () => {
    useUiStore.setState({
      selectedAccountId: "reader-acc",
      settingsOpen: true,
      settingsCategory: "accounts",
      settingsAccountId: "acc-1",
      settingsAddAccount: false,
      settingsAddAccountInitialKind: null,
    });

    useUiStore.getState().handleAccountDeleted("acc-1", ["acc-2"]);

    expect(useUiStore.getState().selectedAccountId).toBe("reader-acc");
    expect(useUiStore.getState().settingsOpen).toBe(true);
    expect(useUiStore.getState().settingsCategory).toBe("accounts");
    expect(useUiStore.getState().settingsAccountId).toBe("acc-2");
    expect(useUiStore.getState().settingsAddAccount).toBe(false);
    expect(useUiStore.getState().settingsAddAccountInitialKind).toBeNull();

    useUiStore.getState().handleAccountDeleted("acc-2", []);

    expect(useUiStore.getState().selectedAccountId).toBe("reader-acc");
    expect(useUiStore.getState().settingsCategory).toBe("accounts");
    expect(useUiStore.getState().settingsAccountId).toBeNull();
    expect(useUiStore.getState().settingsAddAccount).toBe(false);
    expect(useUiStore.getState().settingsAddAccountInitialKind).toBeNull();
  });

  it("replaces the previous toast dismiss timer when showing another transient toast", () => {
    vi.useFakeTimers();

    useUiStore.getState().showToast("First");
    vi.advanceTimersByTime(TOAST_AUTO_DISMISS_TIMEOUT_MS - 1);

    useUiStore.getState().showToast("Second");
    vi.advanceTimersByTime(1);

    expect(useUiStore.getState().toastMessage).toEqual({ message: "Second" });

    vi.advanceTimersByTime(TOAST_AUTO_DISMISS_TIMEOUT_MS - 2);
    expect(useUiStore.getState().toastMessage).toEqual({ message: "Second" });

    vi.advanceTimersByTime(1);
    expect(useUiStore.getState().toastMessage).toBeNull();
  });

  it("does not schedule dismiss timers for persistent toasts", () => {
    vi.useFakeTimers();

    useUiStore.getState().showToast({ message: "Downloading", persistent: true });
    vi.advanceTimersByTime(TOAST_AUTO_DISMISS_TIMEOUT_MS * 2);

    expect(useUiStore.getState().toastMessage).toEqual({
      message: "Downloading",
      persistent: true,
    });
  });
});
