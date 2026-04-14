import { beforeEach, describe, expect, it } from "vitest";
import { useUiStore } from "../../stores/ui-store";

describe("useUiStore", () => {
  beforeEach(() => {
    useUiStore.setState(useUiStore.getInitialState());
  });

  it("initial state defaults", () => {
    const s = useUiStore.getState();
    expect(s.layoutMode).toBe("wide");
    expect(s.contentMode).toBe("empty");
    expect(s.selection).toEqual({ type: "all" });
    expect(s.commandPaletteOpen).toBe(false);
    expect(s.sidebarOpen).toBe(true);
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

  it("opens subscriptions index and cleanup as explicit workspaces", () => {
    expect(useUiStore.getState().subscriptionsWorkspace).toBeNull();
    expect("feedCleanupOpen" in useUiStore.getState()).toBe(false);

    useUiStore.getState().openSubscriptionsIndex();
    expect(useUiStore.getState().subscriptionsWorkspace).toEqual({
      kind: "index",
      cleanupContext: null,
    });
    expect(useUiStore.getState().focusedPane).toBe("content");
    expect("feedCleanupOpen" in useUiStore.getState()).toBe(false);

    useUiStore.getState().openFeedCleanup({ reason: "stale_90d", returnTo: "index" });
    expect(useUiStore.getState().subscriptionsWorkspace).toEqual({
      kind: "cleanup",
      cleanupContext: { reason: "stale_90d", returnTo: "index" },
    });
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

  it("selectSmartView('unread') keeps unread as a complete smart view without footer filtering", () => {
    useUiStore.getState().selectSmartView("unread");

    expect(useUiStore.getState().selection).toEqual({ type: "smart", kind: "unread" });
    expect(useUiStore.getState().viewMode).toBe("unread");
  });

  it("selectSmartView('starred') keeps starred as the selection source and defaults the footer mode to all", () => {
    useUiStore.getState().selectSmartView("starred");

    expect(useUiStore.getState().selection).toEqual({ type: "smart", kind: "starred" });
    expect(useUiStore.getState().viewMode).toBe("all");
  });

  it("selectArticle sets reader mode", () => {
    useUiStore.getState().selectArticle("a1");
    expect(useUiStore.getState().contentMode).toBe("reader");
    expect(useUiStore.getState().selectedArticleId).toBe("a1");
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
});
