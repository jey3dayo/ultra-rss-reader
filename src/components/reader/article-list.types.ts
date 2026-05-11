import type { KeyboardAction } from "@/lib/keyboard/keyboard-shortcuts";

export type ArticleListFailureState = "permission" | "auth" | "network" | "schema";
export type ArticleListSetupState = "none" | "no-accounts" | "no-feeds" | ArticleListFailureState;

export type HandleArticleListKeyboardActionParams = {
  action: KeyboardAction;
  clearArticle: () => void;
  toggleSidebar: () => void;
  openSidebar: () => void;
};
