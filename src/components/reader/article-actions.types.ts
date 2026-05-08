import type { UseMutationResult } from "@tanstack/react-query";
import type { ArticleDto } from "@/api/tauri-commands";
import type { AfterReadingPreference } from "@/lib/preferences-schema";
import type { ViewMode } from "@/lib/view-mode.types";

export type ArticleStatusViewMode = ViewMode;

export type ArticleStatusToast = (message: string) => void;

export type ArticleToastActionParams = {
  showToast: ArticleStatusToast;
  successMessage: string;
};

type ArticleStatusMutation<TVariables> = Pick<UseMutationResult<unknown, Error, TVariables, unknown>, "mutate">;

export type SetReadMutation = ArticleStatusMutation<{ id: string; read: boolean }>;

export type ToggleStarMutation = ArticleStatusMutation<{ id: string; starred: boolean }>;

export type UseArticleStatusActionsParams = {
  articleId: string | null;
  isRead: boolean;
  isStarred: boolean;
  viewMode: ArticleStatusViewMode;
  retainOnUnstar: boolean;
  showToast: ArticleStatusToast;
  addRecentlyRead: (articleId: string) => void;
  removeRecentlyRead: (articleId: string) => void;
  retainArticle: (articleId: string) => void;
  setRead: SetReadMutation;
  toggleStar: ToggleStarMutation;
  starredMessage: string;
  unstarredMessage: string;
};

export type UseArticleStatusActionsResult = {
  setReadStatus: (pressed: boolean) => void;
  setStarStatus: (pressed: boolean, options?: { showStatusToast?: boolean }) => void;
  handleToggleRead: () => void;
  handleToggleStar: () => void;
};

export type UseArticleActionsParams = {
  article: ArticleDto | null;
  viewMode: ArticleStatusViewMode;
  retainOnUnstar: boolean;
  supportsReadingList: boolean;
  showToast: ArticleStatusToast;
  addRecentlyRead: (articleId: string) => void;
  removeRecentlyRead: (articleId: string) => void;
  retainArticle: (articleId: string) => void;
  setRead: SetReadMutation;
  toggleStar: ToggleStarMutation;
  keyboardShortcuts?: ArticleActionKeyboardShortcuts;
};

export type UseArticleActionsResult = UseArticleStatusActionsResult & {
  handleOpenExternalBrowser: () => void;
  handleCopyLink: () => void;
  handleAddToReadingList: () => void;
};

export type ArticleActionKeyboardShortcuts = {
  onToggleBrowserOverlay: () => void;
  onCloseBrowserOverlay: () => void;
};

export type UseArticleActionShortcutsParams = {
  keyboardShortcuts?: ArticleActionKeyboardShortcuts;
  onToggleRead: () => void;
  onToggleStar: () => void;
  onOpenExternalBrowser: () => void;
  onCopyLink: () => void;
  onAddToReadingList: () => void;
};

export type UseArticleAutoMarkParams = {
  articleId: string;
  isRead: boolean;
  afterReading: AfterReadingPreference;
  viewMode: ArticleStatusViewMode;
  retainArticle: (articleId: string) => void;
  addRecentlyRead: (articleId: string) => void;
  removeRecentlyRead?: (articleId: string) => void;
  setRead: SetReadMutation;
  showToast: ArticleStatusToast;
};
