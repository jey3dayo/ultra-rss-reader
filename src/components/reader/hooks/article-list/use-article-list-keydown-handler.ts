import { type KeyboardEvent as ReactKeyboardEvent, useCallback } from "react";
import {
  type ArticleListKeyboardIntent,
  resolveArticleListKeyboardIntent,
} from "@/lib/articles/article-list-keyboard-intent";
import { emitDebugInputTrace } from "@/lib/debug/debug-input-trace";
import type { KeyToActionMap } from "@/lib/keyboard/keyboard-shortcuts";
import { focusArticleContentTarget, focusSelectedSidebarTarget } from "@/lib/reader-focus";
import { useUiStore } from "@/stores/ui-store";
import type { HandleArticleListKeyboardActionParams } from "../../article-list-keyboard-action";
import { handleArticleListKeyboardAction } from "../../article-list-keyboard-action";

type UseArticleListKeydownHandlerParams = {
  selectedArticleId: string | null;
  selectArticle: (articleId: string) => void;
  clearArticle: HandleArticleListKeyboardActionParams["clearArticle"];
  toggleSidebar: HandleArticleListKeyboardActionParams["toggleSidebar"];
  openSidebar: HandleArticleListKeyboardActionParams["openSidebar"];
  keyToAction: KeyToActionMap;
};

type ExecuteArticleListKeyboardIntentParams = Pick<
  UseArticleListKeydownHandlerParams,
  "selectArticle" | "clearArticle" | "toggleSidebar" | "openSidebar"
> & {
  intent: ArticleListKeyboardIntent;
};

type HandleArticleListKeydownEventParams = UseArticleListKeydownHandlerParams & {
  event: ReactKeyboardEvent<HTMLDivElement>;
};

function consumeArticleListKeyEvent(event: ReactKeyboardEvent<HTMLDivElement>) {
  event.preventDefault();
  event.stopPropagation();
}

function focusArticleContentOnNextFrame() {
  requestAnimationFrame(() => {
    focusArticleContentTarget();
  });
}

function resolveArticleListKeyboardIntentFromEvent(
  event: ReactKeyboardEvent<HTMLDivElement>,
  optionTarget: HTMLElement,
  selectedArticleId: string | null,
  keyToAction: KeyToActionMap,
): ArticleListKeyboardIntent | null {
  const uiState = useUiStore.getState();
  return resolveArticleListKeyboardIntent({
    key: event.key,
    metaKey: event.metaKey,
    ctrlKey: event.ctrlKey,
    shiftKey: event.shiftKey,
    optionTargetTag: optionTarget.tagName,
    focusedArticleId: optionTarget.dataset.articleId ?? null,
    selectedArticleId,
    contentMode: uiState.contentMode,
    viewMode: uiState.viewMode,
    keyToAction,
  });
}

function executeArticleListKeyboardIntent({
  intent,
  selectArticle,
  clearArticle,
  toggleSidebar,
  openSidebar,
}: ExecuteArticleListKeyboardIntentParams) {
  if (intent.type === "focus-sidebar") {
    openSidebar();
    requestAnimationFrame(() => {
      focusSelectedSidebarTarget();
    });
    return;
  }

  if (intent.type === "focus-content") {
    if (intent.articleId) {
      selectArticle(intent.articleId);
    }
    focusArticleContentOnNextFrame();
    return;
  }

  handleArticleListKeyboardAction({
    action: intent.action,
    clearArticle,
    toggleSidebar,
    openSidebar,
  });
}

function handleArticleListKeydownEvent({
  event,
  selectedArticleId,
  selectArticle,
  clearArticle,
  toggleSidebar,
  openSidebar,
  keyToAction,
}: HandleArticleListKeydownEventParams) {
  const target = event.target instanceof Element ? event.target : null;
  const optionTarget = target?.closest<HTMLElement>('[role="option"]') ?? null;
  if (!optionTarget) {
    return;
  }

  const intent = resolveArticleListKeyboardIntentFromEvent(event, optionTarget, selectedArticleId, keyToAction);
  if (intent === null) {
    return;
  }

  consumeArticleListKeyEvent(event);
  emitDebugInputTrace(`list-key ${event.key} -> ${intent.debugLabel}`);
  executeArticleListKeyboardIntent({
    intent,
    selectArticle,
    clearArticle,
    toggleSidebar,
    openSidebar,
  });
}

export function useArticleListKeydownHandler({
  selectedArticleId,
  selectArticle,
  clearArticle,
  toggleSidebar,
  openSidebar,
  keyToAction,
}: UseArticleListKeydownHandlerParams) {
  return useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      handleArticleListKeydownEvent({
        event,
        selectedArticleId,
        selectArticle,
        clearArticle,
        toggleSidebar,
        openSidebar,
        keyToAction,
      });
    },
    [clearArticle, keyToAction, openSidebar, selectArticle, selectedArticleId, toggleSidebar],
  );
}
