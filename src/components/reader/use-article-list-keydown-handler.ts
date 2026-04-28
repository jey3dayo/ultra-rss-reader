import { Result } from "@praha/byethrow";
import { type KeyboardEvent as ReactKeyboardEvent, useCallback } from "react";
import { emitDebugInputTrace } from "@/lib/debug-input-trace";
import { resolveKeyboardAction } from "@/lib/keyboard-shortcuts";
import { focusArticleContentTarget, focusSelectedSidebarTarget } from "@/lib/reader-focus";
import { useUiStore } from "@/stores/ui-store";
import type { UseArticleListKeydownHandlerParams } from "./article-list.types";
import { handleArticleListKeyboardAction } from "./article-list-keyboard-action";

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
        event.preventDefault();
        event.stopPropagation();

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
        event.preventDefault();
        event.stopPropagation();

        emitDebugInputTrace("list-key ArrowLeft -> focus-sidebar");
        openSidebar();
        requestAnimationFrame(() => {
          focusSelectedSidebarTarget();
        });
        return;
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        event.stopPropagation();

        emitDebugInputTrace("list-key ArrowRight -> focus-content");
        const focusedArticleId = optionTarget.dataset.articleId;
        if (focusedArticleId && focusedArticleId !== selectedArticleId) {
          selectArticle(focusedArticleId);
          requestAnimationFrame(() => {
            focusArticleContentTarget();
          });
          return;
        }
        if (focusedArticleId) {
          selectArticle(focusedArticleId);
        }
        requestAnimationFrame(() => {
          focusArticleContentTarget();
        });
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

      event.preventDefault();
      event.stopPropagation();

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
