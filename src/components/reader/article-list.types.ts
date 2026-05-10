import type { KeyboardAction } from "@/lib/keyboard/keyboard-shortcuts";

export type ArticleListSetupState = "none" | "no-accounts" | "no-feeds";

export type HandleArticleListKeyboardActionParams = {
  action: KeyboardAction;
  clearArticle: () => void;
  toggleSidebar: () => void;
  openSidebar: () => void;
};
