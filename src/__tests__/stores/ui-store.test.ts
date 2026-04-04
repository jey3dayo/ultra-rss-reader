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

  it("opens and closes the feed cleanup surface", () => {
    expect(useUiStore.getState().feedCleanupOpen).toBe(false);

    useUiStore.getState().openFeedCleanup();
    expect(useUiStore.getState().feedCleanupOpen).toBe(true);

    useUiStore.getState().closeFeedCleanup();
    expect(useUiStore.getState().feedCleanupOpen).toBe(false);
  });

  it("selectFeed updates selection", () => {
    useUiStore.getState().selectFeed("f1");
    expect(useUiStore.getState().selection).toEqual({ type: "feed", feedId: "f1" });
    expect(useUiStore.getState().selectedArticleId).toBeNull();
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
  });

  it("closeBrowser returns to reader if article selected", () => {
    useUiStore.getState().selectArticle("a1");
    useUiStore.getState().openBrowser("https://ex.com");
    useUiStore.getState().closeBrowser();
    expect(useUiStore.getState().contentMode).toBe("reader");
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
