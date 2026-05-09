import { Result } from "@praha/byethrow";
import { type KeyboardEvent as ReactKeyboardEvent, useCallback } from "react";
import { emitDebugInputTrace } from "@/lib/debug/debug-input-trace";
import { type KeyToActionMap, resolveKeyboardAction } from "@/lib/keyboard/keyboard-shortcuts";
import { focusArticleContentTarget, focusSelectedSidebarTarget } from "@/lib/reader-focus";
import { useUiStore } from "@/stores/ui-store";
import type { HandleArticleListKeyboardActionParams } from "../../article-list.types";
import { handleArticleListKeyboardAction } from "../../article-list-keyboard-action";

type UseArticleListKeydownHandlerParams = {
  selectedArticleId: string | null;
  selectArticle: (articleId: string) => void;
  clearArticle: HandleArticleListKeyboardActionParams["clearArticle"];
  toggleSidebar: HandleArticleListKeyboardActionParams["toggleSidebar"];
  openSidebar: HandleArticleListKeyboardActionParams["openSidebar"];
  keyToAction: KeyToActionMap;
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
      const target = event.target instanceof Element ? event.target : null;
      const optionTarget = target?.closest<HTMLElement>('[role="option"]') ?? null;
      if (!optionTarget) {
        return;
      }

      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        consumeArticleListKeyEvent(event);

        const direction = event.key === "ArrowDown" ? 1 : -1;
        emitDebugInputTrace(`list-key ${event.key} -> navigate-article`);
        handleArticleListKeyboardAction({
          action: { type: "navigate-article", direction },
          clearArticle,
          toggleSidebar,
          openSidebar,
        });
        return;
      }

      if (event.key === "ArrowLeft") {
        consumeArticleListKeyEvent(event);

        emitDebugInputTrace("list-key ArrowLeft -> focus-sidebar");
        openSidebar();
        requestAnimationFrame(() => {
          focusSelectedSidebarTarget();
        });
        return;
      }

      if (event.key === "ArrowRight") {
        consumeArticleListKeyEvent(event);

        emitDebugInputTrace("list-key ArrowRight -> focus-content");
        const focusedArticleId = optionTarget.dataset.articleId;
        if (focusedArticleId) {
          selectArticle(focusedArticleId);
        }
        focusArticleContentOnNextFrame();
        return;
      }

      const action = resolveKeyboardAction({
        key: event.key,
        metaKey: event.metaKey,
        ctrlKey: event.ctrlKey,
        shiftKey: event.shiftKey,
        targetTag: optionTarget.tagName,
        selectedArticleId,
        contentMode: useUiStore.getState().contentMode,
        viewMode: useUiStore.getState().viewMode,
        keyToAction,
      });

      if (Result.isFailure(action)) {
        return;
      }

      consumeArticleListKeyEvent(event);

      const resolvedAction = Result.unwrap(action);
      emitDebugInputTrace(`list-key ${event.key} -> ${resolvedAction.type}`);
      handleArticleListKeyboardAction({
        action: resolvedAction,
        clearArticle,
        toggleSidebar,
        openSidebar,
      });
    },
    [clearArticle, keyToAction, openSidebar, selectArticle, selectedArticleId, toggleSidebar],
  );
}
