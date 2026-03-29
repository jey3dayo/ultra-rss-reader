import { create } from "zustand";

let toastTimer: ReturnType<typeof setTimeout> | null = null;

export type ToastAction = {
  label: string;
  onClick: () => void;
};

export type ToastData = {
  message: string;
  persistent?: boolean;
  progress?: number | null;
  actions?: ToastAction[];
};

type Selection =
  | { type: "feed"; feedId: string }
  | { type: "folder"; folderId: string }
  | { type: "smart"; kind: "unread" | "starred" }
  | { type: "tag"; tagId: string }
  | { type: "all" };

type LayoutMode = "wide" | "compact" | "mobile";
type FocusedPane = "sidebar" | "list" | "content";
type ContentMode = "empty" | "reader" | "browser" | "loading";
export type SettingsCategory = "general" | "appearance" | "reading" | "shortcuts" | "actions" | "accounts";
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
  settingsOpen: boolean;
  settingsCategory: SettingsCategory;
  settingsAccountId: string | null;
  settingsAddAccount: boolean;
  commandPaletteOpen: boolean;
  isAddFeedDialogOpen: boolean;
  toastMessage: ToastData | null;
  recentlyReadIds: Set<string>;
  confirmDialog: {
    open: boolean;
    message: string;
    actionLabel: string | null;
    onConfirm: (() => void) | null;
  };
}

interface UiActions {
  setLayoutMode: (mode: LayoutMode) => void;
  setFocusedPane: (pane: FocusedPane) => void;
  selectAccount: (id: string) => void;
  selectFeed: (feedId: string) => void;
  selectFolder: (folderId: string) => void;
  selectSmartView: (kind: "unread" | "starred") => void;
  selectTag: (tagId: string) => void;
  selectAll: () => void;
  selectArticle: (id: string) => void;
  clearArticle: () => void;
  openBrowser: (url: string) => void;
  closeBrowser: () => void;
  setViewMode: (mode: "all" | "unread" | "starred") => void;
  setSearchQuery: (query: string) => void;
  toggleFolder: (folderId: string) => void;
  openSettings: (tab?: SettingsCategory) => void;
  closeSettings: () => void;
  openAddFeedDialog: () => void;
  closeAddFeedDialog: () => void;
  setSettingsCategory: (cat: SettingsCategory) => void;
  setSettingsAccountId: (id: string | null) => void;
  setSettingsAddAccount: (show: boolean) => void;
  openCommandPalette: () => void;
  closeCommandPalette: () => void;
  toggleCommandPalette: () => void;
  showToast: (message: string | ToastData) => void;
  clearToast: () => void;
  addRecentlyRead: (id: string) => void;
  clearRecentlyRead: () => void;
  showConfirm: (message: string, onConfirm: () => void, actionLabel?: string) => void;
  closeConfirm: () => void;
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
  settingsOpen: false,
  settingsCategory: "general",
  settingsAccountId: null,
  settingsAddAccount: false,
  commandPaletteOpen: false,
  isAddFeedDialogOpen: false,
  toastMessage: null,
  recentlyReadIds: new Set(),
  confirmDialog: { open: false, message: "", actionLabel: null, onConfirm: null },
};

export const useUiStore = create<UiState & UiActions>()((set) => ({
  ...initialState,
  setLayoutMode: (mode) => set({ layoutMode: mode }),
  setFocusedPane: (pane) => set({ focusedPane: pane }),
  selectAccount: (id) =>
    set({
      selectedAccountId: id,
      selection: { type: "all" },
      viewMode: "all",
      selectedArticleId: null,
      contentMode: "empty",
      focusedPane: "list",
      recentlyReadIds: new Set(),
    }),
  selectFeed: (feedId) =>
    set({
      selection: { type: "feed", feedId },
      viewMode: "all",
      selectedArticleId: null,
      contentMode: "empty",
      focusedPane: "list",
      recentlyReadIds: new Set(),
    }),
  selectFolder: (folderId) =>
    set({
      selection: { type: "folder", folderId },
      viewMode: "all",
      selectedArticleId: null,
      contentMode: "empty",
      focusedPane: "list",
      recentlyReadIds: new Set(),
    }),
  selectSmartView: (kind) =>
    set({
      selection: { type: "smart", kind },
      viewMode: kind,
      selectedArticleId: null,
      contentMode: "empty",
      focusedPane: "list",
      recentlyReadIds: new Set(),
    }),
  selectTag: (tagId) =>
    set({
      selection: { type: "tag", tagId },
      viewMode: "all",
      selectedArticleId: null,
      contentMode: "empty",
      focusedPane: "list",
      recentlyReadIds: new Set(),
    }),
  selectAll: () =>
    set({
      selection: { type: "all" },
      viewMode: "all",
      selectedArticleId: null,
      contentMode: "empty",
      focusedPane: "list",
      recentlyReadIds: new Set(),
    }),
  selectArticle: (id) => set({ selectedArticleId: id, contentMode: "reader", focusedPane: "content" }),
  clearArticle: () => set({ selectedArticleId: null, contentMode: "empty" }),
  openBrowser: (url) => set({ contentMode: "browser", browserUrl: url }),
  closeBrowser: () => set((s) => ({ contentMode: s.selectedArticleId ? "reader" : "empty", browserUrl: null })),
  setViewMode: (mode) => set({ viewMode: mode, recentlyReadIds: new Set() }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  toggleFolder: (folderId) =>
    set((s) => {
      const next = new Set(s.expandedFolderIds);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return { expandedFolderIds: next };
    }),
  openSettings: (tab?: SettingsCategory) =>
    set((s) => ({ settingsOpen: true, settingsCategory: tab ?? s.settingsCategory })),
  openAddFeedDialog: () => set({ isAddFeedDialogOpen: true }),
  closeAddFeedDialog: () => set({ isAddFeedDialogOpen: false }),
  closeSettings: () =>
    set({ settingsOpen: false, settingsCategory: "general", settingsAccountId: null, settingsAddAccount: false }),
  setSettingsCategory: (cat) => set({ settingsCategory: cat, settingsAccountId: null, settingsAddAccount: false }),
  setSettingsAccountId: (id) => set({ settingsAccountId: id, settingsAddAccount: false }),
  setSettingsAddAccount: (show) => set({ settingsAddAccount: show, settingsAccountId: null }),
  openCommandPalette: () => set({ commandPaletteOpen: true }),
  closeCommandPalette: () => set({ commandPaletteOpen: false }),
  toggleCommandPalette: () => set((s) => ({ commandPaletteOpen: !s.commandPaletteOpen })),
  showToast: (message) => {
    if (toastTimer) clearTimeout(toastTimer);
    const data: ToastData = typeof message === "string" ? { message } : message;
    set({ toastMessage: data });
    if (!data.persistent) {
      toastTimer = setTimeout(() => {
        set({ toastMessage: null });
        toastTimer = null;
      }, 4000);
    }
  },
  clearToast: () => set({ toastMessage: null }),
  addRecentlyRead: (id) =>
    set((s) => {
      const next = new Set(s.recentlyReadIds);
      next.add(id);
      return { recentlyReadIds: next };
    }),
  clearRecentlyRead: () => set({ recentlyReadIds: new Set() }),
  showConfirm: (message, onConfirm, actionLabel) =>
    set({ confirmDialog: { open: true, message, actionLabel: actionLabel ?? null, onConfirm } }),
  closeConfirm: () => set({ confirmDialog: { open: false, message: "", actionLabel: null, onConfirm: null } }),
}));
