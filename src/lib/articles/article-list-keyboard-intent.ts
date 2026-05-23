import { Result } from "@praha/byethrow";
import { type KeyboardAction, type KeyToActionMap, resolveKeyboardAction } from "@/lib/keyboard/keyboard-shortcuts";
import type { ContentMode } from "@/lib/layout/layout-state.types";
import type { ViewMode } from "@/lib/reader/view-mode.types";

export type ArticleListKeyboardIntent =
  | {
      type: "keyboard-action";
      action: KeyboardAction;
      debugLabel: KeyboardAction["type"];
    }
  | {
      type: "focus-sidebar";
      debugLabel: "focus-sidebar";
    }
  | {
      type: "focus-content";
      articleId: string | null;
      debugLabel: "focus-content";
    };

export type ResolveArticleListKeyboardIntentParams = {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  optionTargetTag: string;
  focusedArticleId: string | null;
  selectedArticleId: string | null;
  contentMode: ContentMode;
  viewMode: ViewMode;
  keyToAction: KeyToActionMap;
};

export function resolveArticleListKeyboardIntent({
  key,
  metaKey,
  ctrlKey,
  shiftKey,
  optionTargetTag,
  focusedArticleId,
  selectedArticleId,
  contentMode,
  viewMode,
  keyToAction,
}: ResolveArticleListKeyboardIntentParams): ArticleListKeyboardIntent | null {
  if (key === "ArrowDown" || key === "ArrowUp") {
    return {
      type: "keyboard-action",
      action: {
        type: "navigate-article",
        direction: key === "ArrowDown" ? 1 : -1,
      },
      debugLabel: "navigate-article",
    };
  }

  if (key === "ArrowLeft") {
    return {
      type: "focus-sidebar",
      debugLabel: "focus-sidebar",
    };
  }

  if (key === "ArrowRight") {
    return {
      type: "focus-content",
      articleId: focusedArticleId,
      debugLabel: "focus-content",
    };
  }

  const action = resolveKeyboardAction({
    key,
    metaKey,
    ctrlKey,
    shiftKey,
    targetTag: optionTargetTag,
    selectedArticleId,
    contentMode,
    viewMode,
    keyToAction,
  });

  if (Result.isFailure(action)) {
    return null;
  }

  const resolvedAction = Result.unwrap(action);
  return {
    type: "keyboard-action",
    action: resolvedAction,
    debugLabel: resolvedAction.type,
  };
}
