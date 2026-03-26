import { create } from "zustand";

type Selection =
  | { type: "feed"; feedId: string }
  | { type: "folder"; folderId: string }
  | { type: "smart"; kind: "unread" | "starred" }
  | { type: "all" };

type LayoutMode = "wide" | "compact" | "mobile";
type FocusedPane = "sidebar" | "list" | "content";
type ContentMode = "empty" | "reader" | "browser" | "loading";

interface UiState {
  layoutMode: LayoutMode;
  focusedPane: FocusedPane;
  contentMode: ContentMode;
  selectedAccountId: string | null;
  selection: Selection;
  selectedArticleId: string | null;
  viewMode: "all" | "unread" | "starred";
  searchQuery: string;
  browserUrl: string | null;
  expandedFolderIds: Set<string>;
}

interface UiActions {
  setLayoutMode: (mode: LayoutMode) => void;
  setFocusedPane: (pane: FocusedPane) => void;
  selectAccount: (id: string) => void;
  selectFeed: (feedId: string) => void;
  selectFolder: (folderId: string) => void;
  selectSmartView: (kind: "unread" | "starred") => void;
  selectAll: () => void;
  selectArticle: (id: string) => void;
  clearArticle: () => void;
  openBrowser: (url: string) => void;
  closeBrowser: () => void;
  setViewMode: (mode: "all" | "unread" | "starred") => void;
  setSearchQuery: (query: string) => void;
  toggleFolder: (folderId: string) => void;
}

const initialState: UiState = {
  layoutMode: "wide",
  focusedPane: "sidebar",
  contentMode: "empty",
  selectedAccountId: null,
  selection: { type: "all" },
  selectedArticleId: null,
  viewMode: "all",
  searchQuery: "",
  browserUrl: null,
  expandedFolderIds: new Set(),
};

export const useUiStore = create<UiState & UiActions>()((set) => ({
  ...initialState,
  setLayoutMode: (mode) => set({ layoutMode: mode }),
  setFocusedPane: (pane) => set({ focusedPane: pane }),
  selectAccount: (id) =>
    set({ selectedAccountId: id, selection: { type: "all" }, selectedArticleId: null, contentMode: "empty" }),
  selectFeed: (feedId) =>
    set({ selection: { type: "feed", feedId }, selectedArticleId: null, contentMode: "empty", focusedPane: "list" }),
  selectFolder: (folderId) =>
    set({ selection: { type: "folder", folderId }, selectedArticleId: null, contentMode: "empty" }),
  selectSmartView: (kind) => set({ selection: { type: "smart", kind }, selectedArticleId: null, contentMode: "empty" }),
  selectAll: () => set({ selection: { type: "all" }, selectedArticleId: null, contentMode: "empty" }),
  selectArticle: (id) => set({ selectedArticleId: id, contentMode: "reader", focusedPane: "content" }),
  clearArticle: () => set({ selectedArticleId: null, contentMode: "empty" }),
  openBrowser: (url) => set({ contentMode: "browser", browserUrl: url }),
  closeBrowser: () => set((s) => ({ contentMode: s.selectedArticleId ? "reader" : "empty", browserUrl: null })),
  setViewMode: (mode) => set({ viewMode: mode }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  toggleFolder: (folderId) =>
    set((s) => {
      const next = new Set(s.expandedFolderIds);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return { expandedFolderIds: next };
    }),
}));
