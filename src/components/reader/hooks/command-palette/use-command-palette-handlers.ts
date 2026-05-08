import { addToHistory } from "@/components/reader/hooks/command-palette/use-command-history";
import { type RuntimeDevScenario, runRuntimeDevScenario } from "@/dev/scenario-runtime";
import { executeAction } from "@/lib/actions";
import type { ToastData } from "@/lib/ui/toast.types";
import type { PaletteAction } from "../../command-palette.types";
import { createCommandPaletteHistoryValue } from "../../command-palette-history";

type UseCommandPaletteHandlersParams = {
  closePalette: () => void;
  openShortcutsHelp: () => void;
  showToast: (message: string | ToastData) => void;
  selectFeedFromCurrentContext: (feedId: string) => void;
  selectTagFromCurrentContext: (tagId: string) => void;
  selectArticle: (articleId: string) => void;
  openFeedLanding: (feedId: string) => Promise<void>;
};

type UseCommandPaletteHandlersResult = {
  handleActionSelect: (action: PaletteAction["id"]) => void;
  handleFeedSelect: (feedId: string) => void;
  handleTagSelect: (tagId: string) => void;
  handleArticleSelect: (feedId: string, articleId: string) => void;
  handleDevScenarioSelect: (scenarioId: RuntimeDevScenario["id"]) => void;
};

export function useCommandPaletteHandlers({
  closePalette,
  openShortcutsHelp,
  showToast,
  selectFeedFromCurrentContext,
  selectTagFromCurrentContext,
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
    selectTagFromCurrentContext(tagId);
    closePalette();
  }

  function handleArticleSelect(feedId: string, articleId: string) {
    addToHistory(createCommandPaletteHistoryValue({ kind: "article", id: articleId }));
    selectFeedFromCurrentContext(feedId);
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
