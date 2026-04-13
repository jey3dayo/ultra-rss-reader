import { Result } from "@praha/byethrow";
import { type KeyboardEvent as ReactKeyboardEvent, useCallback } from "react";
import { emitDebugInputTrace } from "@/lib/debug-input-trace";
import { resolveKeyboardAction } from "@/lib/keyboard-shortcuts";
import { useUiStore } from "@/stores/ui-store";
import type { UseArticleListKeydownHandlerParams } from "./article-list.types";
import { handleArticleListKeyboardAction } from "./article-list-keyboard-action";

export function useArticleListKeydownHandler({
  selectedArticleId,
  clearArticle,
  toggleSidebar,
  openSidebar,
  keyToAction,
}: UseArticleListKeydownHandlerParams) {
  return useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target?.closest('[role="option"]')) {
        return;
      }

      const action = resolveKeyboardAction({
        key: event.key,
        metaKey: event.metaKey,
        ctrlKey: event.ctrlKey,
        shiftKey: event.shiftKey,
        targetTag: target.tagName,
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
    [clearArticle, keyToAction, openSidebar, selectedArticleId, toggleSidebar],
  );
}
