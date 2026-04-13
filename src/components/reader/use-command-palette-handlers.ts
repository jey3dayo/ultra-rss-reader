import { addToHistory } from "@/hooks/use-command-history";
import { executeAction } from "@/lib/actions";
import { type RuntimeDevScenario, runRuntimeDevScenario } from "@/lib/dev-scenario-runtime";
import type { PaletteAction } from "./use-command-palette-data";
import type { useCommandPaletteUiState } from "./use-command-palette-ui-state";

type UseCommandPaletteHandlersParams = Pick<
  ReturnType<typeof useCommandPaletteUiState>,
  "openShortcutsHelp" | "showToast" | "selectFeed" | "selectTag" | "selectArticle"
> & {
  closePalette: () => void;
  openFeedLanding: (feedId: string) => Promise<void>;
};

const COMMAND_PALETTE_HISTORY_PREFIX = {
  action: "action:",
  feed: "feed:",
  tag: "tag:",
  article: "article:",
} as const;

export function useCommandPaletteHandlers({
  closePalette,
  openShortcutsHelp,
  showToast,
  selectFeed,
  selectTag,
  selectArticle,
  openFeedLanding,
}: UseCommandPaletteHandlersParams) {
  function handleActionSelect(action: PaletteAction["id"]) {
    if (action === "open-shortcuts-help") {
      openShortcutsHelp();
      closePalette();
      return;
    }
    addToHistory(`${COMMAND_PALETTE_HISTORY_PREFIX.action}${action}`);
    executeAction(action);
    closePalette();
  }

  function handleFeedSelect(feedId: string) {
    addToHistory(`${COMMAND_PALETTE_HISTORY_PREFIX.feed}${feedId}`);
    void openFeedLanding(feedId);
    closePalette();
  }

  function handleTagSelect(tagId: string) {
    addToHistory(`${COMMAND_PALETTE_HISTORY_PREFIX.tag}${tagId}`);
    selectTag(tagId);
    closePalette();
  }

  function handleArticleSelect(feedId: string, articleId: string) {
    addToHistory(`${COMMAND_PALETTE_HISTORY_PREFIX.article}${articleId}`);
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
