import { addToHistory } from "@/hooks/use-command-history";
import { executeAction } from "@/lib/actions";
import { type RuntimeDevScenario, runRuntimeDevScenario } from "@/lib/dev-scenario-runtime";
import type {
  PaletteAction,
  UseCommandPaletteHandlersParams,
  UseCommandPaletteHandlersResult,
} from "./command-palette.types";
import { createCommandPaletteHistoryValue } from "./command-palette-history";

export function useCommandPaletteHandlers({
  closePalette,
  openShortcutsHelp,
  showToast,
  selectFeed,
  selectTag,
  selectArticle,
  openFeedLanding,
}: UseCommandPaletteHandlersParams): UseCommandPaletteHandlersResult {
  function handleActionSelect(action: PaletteAction["id"]) {
    if (action === "open-shortcuts-help") {
      openShortcutsHelp();
      closePalette();
      return;
    }
    addToHistory(createCommandPaletteHistoryValue({ kind: "action", id: action }));
    executeAction(action);
    closePalette();
  }

  function handleFeedSelect(feedId: string) {
    addToHistory(createCommandPaletteHistoryValue({ kind: "feed", id: feedId }));
    void openFeedLanding(feedId);
    closePalette();
  }

  function handleTagSelect(tagId: string) {
    addToHistory(createCommandPaletteHistoryValue({ kind: "tag", id: tagId }));
    selectTag(tagId);
    closePalette();
  }

  function handleArticleSelect(feedId: string, articleId: string) {
    addToHistory(createCommandPaletteHistoryValue({ kind: "article", id: articleId }));
    selectFeed(feedId);
    selectArticle(articleId);
    closePalette();
  }

  function handleDevScenarioSelect(scenarioId: RuntimeDevScenario["id"]) {
    void runRuntimeDevScenario(scenarioId).catch((error) => {
      const message = error instanceof Error ? error.message : "Unknown error";
      showToast(`Failed to run dev scenario "${scenarioId}": ${message}`);
    });
    closePalette();
  }

  return {
    handleActionSelect,
    handleFeedSelect,
    handleTagSelect,
    handleArticleSelect,
    handleDevScenarioSelect,
  };
}
