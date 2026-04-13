import type { UseMutationResult } from "@tanstack/react-query";
import type { ArticleDto } from "@/api/tauri-commands";
import type { ArticleActionKeyboardShortcuts } from "./use-article-action-shortcuts";

export type ArticleStatusViewMode = "all" | "unread" | "starred";

export type ArticleStatusToast = (message: string) => void;

export type ArticleToastActionParams = {
  showToast: ArticleStatusToast;
  successMessage: string;
};

export type SetReadMutation = UseMutationResult<unknown, Error, { id: string; read: boolean }, unknown>;

export type ToggleStarMutation = UseMutationResult<unknown, Error, { id: string; starred: boolean }, unknown>;

export type UseArticleStatusActionsParams = {
  articleId: string | null;
  isRead: boolean;
  isStarred: boolean;
  viewMode: ArticleStatusViewMode;
  showToast: ArticleStatusToast;
  addRecentlyRead: (articleId: string) => void;
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
  supportsReadingList: boolean;
  showToast: ArticleStatusToast;
  addRecentlyRead: (articleId: string) => void;
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

export type UseArticleActionShortcutsParams = {
  keyboardShortcuts?: ArticleActionKeyboardShortcuts;
  onToggleRead: () => void;
  onToggleStar: () => void;
  onOpenExternalBrowser: () => void;
  onCopyLink: () => void;
  onAddToReadingList: () => void;
};
