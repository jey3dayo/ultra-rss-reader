export type ArticleStatusToast = (message: string) => void;

export type ArticleToastActionParams = {
  showToast: ArticleStatusToast;
  successMessage: string;
};

export type ArticleActionKeyboardShortcuts = {
  onToggleBrowserOverlay: () => void;
  onCloseBrowserOverlay: () => void;
};
