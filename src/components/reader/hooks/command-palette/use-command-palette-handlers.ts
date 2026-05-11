import { Result } from "@praha/byethrow";
import { useRef } from "react";
import { addToHistory } from "@/components/reader/hooks/command-palette/use-command-history";
import { type RuntimeDevScenario, runRuntimeDevScenario } from "@/dev/scenario-runtime";
import type { FeedLandingFailure, FeedLandingResult } from "@/hooks/use-feed-landing";
import { executeAction } from "@/lib/actions";
import { isAppActionAvailable } from "@/lib/app-actions";
import { createCommandPaletteHistoryValue } from "@/lib/command-palette/command-history";
import i18n from "@/lib/i18n";
import type { ToastData } from "@/lib/ui/toast.types";
import enReader from "@/locales/en/reader.json";
import jaReader from "@/locales/ja/reader.json";
import { useUiStore } from "@/stores/ui-store";
import type { PaletteAction } from "../../command-palette.types";

type UseCommandPaletteHandlersParams = {
  closePalette: () => void;
  openShortcutsHelp: () => void;
  showToast: (message: string | ToastData) => void;
  selectedAccountId: string | null;
  isSyncing: boolean;
  selectFeedFromCurrentContext: (feedId: string) => void;
  selectTagFromCurrentContext: (tagId: string) => void;
  selectArticle: (articleId: string) => void;
  openFeedLanding: (feedId: string) => Promise<FeedLandingResult>;
  paletteSessionId: number;
  commandPaletteOpen?: boolean;
  canSelectArticle: (feedId: string, articleId: string) => boolean;
  canSelectTag?: (tagId: string) => boolean;
};

type UseCommandPaletteHandlersResult = {
  handleActionSelect: (action: PaletteAction["id"]) => void;
  handleFeedSelect: (feedId: string) => void;
  handleTagSelect: (tagId: string) => void;
  handleArticleSelect: (feedId: string, articleId: string) => void;
  handleDevScenarioSelect: (scenarioId: RuntimeDevScenario["id"]) => void;
};

function getUnknownErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error";
}

const commandPaletteMessages = {
  en: enReader.command_palette,
  ja: jaReader.command_palette,
} as const;

type CommandPaletteMessageKey = keyof (typeof commandPaletteMessages)["en"];

export function translateCommandPaletteFallbackMessage(
  key: CommandPaletteMessageKey,
  language: string,
  values?: Record<string, string>,
) {
  const fallbackLanguage = language === "ja" ? "ja" : "en";
  const template = commandPaletteMessages[fallbackLanguage][key];
  return Object.entries(values ?? {}).reduce(
    (message, [name, value]) => message.replaceAll(`{{${name}}}`, value),
    template,
  );
}

function translateCommandPaletteMessage(key: CommandPaletteMessageKey, values?: Record<string, string>) {
  const i18nKey = `command_palette.${key}`;
  const translated = Result.try({
    try: () => i18n.t(i18nKey, i18nKey, { ns: "reader", ...values }),
    catch: (error) => (error instanceof Error ? error : new Error(String(error))),
  });
  if (Result.isFailure(translated)) {
    return translateCommandPaletteFallbackMessage(key, i18n.language, values);
  }

  const translatedValue = Result.unwrap(translated);
  if (translatedValue !== i18nKey) {
    return translatedValue;
  }

  return translateCommandPaletteFallbackMessage(key, i18n.language, values);
}

export function getFeedLandingFailureMessage(error: FeedLandingFailure) {
  switch (error.type) {
    case "missing_account":
      return translateCommandPaletteMessage("feed_landing_missing_account");
    case "feed_not_found":
      return translateCommandPaletteMessage("feed_landing_feed_not_found");
    case "landing_fetch_failed":
      return error.message;
  }
}

export function useCommandPaletteHandlers({
  closePalette,
  openShortcutsHelp,
  showToast,
  selectedAccountId,
  isSyncing,
  selectFeedFromCurrentContext,
  selectTagFromCurrentContext,
  selectArticle,
  openFeedLanding,
  paletteSessionId,
  commandPaletteOpen = true,
  canSelectArticle,
  canSelectTag = () => true,
}: UseCommandPaletteHandlersParams): UseCommandPaletteHandlersResult {
  const feedLandingRequestIdRef = useRef(0);
  const devScenarioRequestIdRef = useRef(0);
  const selectedAccountIdRef = useRef(selectedAccountId);
  const paletteSessionIdRef = useRef(paletteSessionId);
  const commandPaletteOpenRef = useRef(commandPaletteOpen);
  const submittedPaletteSelectionRef = useRef<string | null>(null);
  if (selectedAccountIdRef.current !== selectedAccountId) {
    selectedAccountIdRef.current = selectedAccountId;
    feedLandingRequestIdRef.current += 1;
    devScenarioRequestIdRef.current += 1;
  }
  if (paletteSessionIdRef.current !== paletteSessionId) {
    paletteSessionIdRef.current = paletteSessionId;
    submittedPaletteSelectionRef.current = null;
    devScenarioRequestIdRef.current += 1;
  }
  commandPaletteOpenRef.current = commandPaletteOpen;

  function tryClaimPaletteSubmit(selectionKey: string) {
    const submitKey = `${paletteSessionIdRef.current}:${selectionKey}`;
    if (!commandPaletteOpenRef.current || submittedPaletteSelectionRef.current === submitKey) {
      return false;
    }

    submittedPaletteSelectionRef.current = submitKey;
    return true;
  }

  function handleActionSelect(action: PaletteAction["id"]) {
    if (!commandPaletteOpenRef.current) {
      return;
    }

    if (action === "open-shortcuts-help") {
      if (!tryClaimPaletteSubmit(`action:${action}`)) {
        return;
      }

      openShortcutsHelp();
      closePalette();
      return;
    }
    const uiState = useUiStore.getState();
    if (
      !isAppActionAvailable(action, "commandPalette", {
        selectedAccountId: selectedAccountIdRef.current,
        selectedArticleId: uiState.selectedArticleId,
        contentMode: uiState.contentMode,
        commandPaletteOpen: commandPaletteOpenRef.current,
        settingsOpen: uiState.settingsOpen,
        shortcutsHelpOpen: uiState.shortcutsHelpOpen,
        isAddFeedDialogOpen: uiState.isAddFeedDialogOpen,
        isSyncing,
      }) ||
      (!selectedAccountIdRef.current &&
        (action === "open-add-feed" || action === "sync-all" || action === "mark-all-read")) ||
      (isSyncing && action === "sync-all")
    ) {
      return;
    }

    if (!tryClaimPaletteSubmit(`action:${action}`)) {
      return;
    }

    addToHistory(createCommandPaletteHistoryValue({ kind: "action", id: action }));
    executeAction(action);
    closePalette();
  }

  function handleFeedSelect(feedId: string) {
    if (!tryClaimPaletteSubmit(`feed:${feedId}`)) {
      return;
    }

    const requestId = feedLandingRequestIdRef.current + 1;
    feedLandingRequestIdRef.current = requestId;
    const requestAccountId = selectedAccountIdRef.current;
    addToHistory(createCommandPaletteHistoryValue({ kind: "feed", id: feedId }));
    void openFeedLanding(feedId)
      .then((result) => {
        if (requestId !== feedLandingRequestIdRef.current || requestAccountId !== selectedAccountIdRef.current) {
          return;
        }

        if (Result.isFailure(result)) {
          const message = getFeedLandingFailureMessage(Result.unwrapError(result));
          showToast(
            translateCommandPaletteMessage("feed_landing_failed", {
              feedId,
              message,
            }),
          );
        }
      })
      .catch((error) => {
        if (requestId !== feedLandingRequestIdRef.current || requestAccountId !== selectedAccountIdRef.current) {
          return;
        }

        showToast(
          translateCommandPaletteMessage("feed_landing_failed", {
            feedId,
            message: getUnknownErrorMessage(error),
          }),
        );
      });
    closePalette();
  }

  function handleTagSelect(tagId: string) {
    if (!canSelectTag(tagId)) {
      return;
    }

    if (!tryClaimPaletteSubmit(`tag:${tagId}`)) {
      return;
    }

    addToHistory(createCommandPaletteHistoryValue({ kind: "tag", id: tagId }));
    selectTagFromCurrentContext(tagId);
    closePalette();
  }

  function handleArticleSelect(feedId: string, articleId: string) {
    if (!canSelectArticle(feedId, articleId)) {
      return;
    }

    if (!tryClaimPaletteSubmit(`article:${articleId}`)) {
      return;
    }

    addToHistory(createCommandPaletteHistoryValue({ kind: "article", id: articleId }));
    selectFeedFromCurrentContext(feedId);
    selectArticle(articleId);
    closePalette();
  }

  function handleDevScenarioSelect(scenarioId: RuntimeDevScenario["id"]) {
    if (!tryClaimPaletteSubmit(`scenario:${scenarioId}`)) {
      return;
    }

    const requestId = devScenarioRequestIdRef.current + 1;
    devScenarioRequestIdRef.current = requestId;
    const requestAccountId = selectedAccountIdRef.current;
    const requestPaletteSessionId = paletteSessionIdRef.current;
    void runRuntimeDevScenario(scenarioId).catch((error) => {
      if (
        requestId !== devScenarioRequestIdRef.current ||
        requestAccountId !== selectedAccountIdRef.current ||
        requestPaletteSessionId !== paletteSessionIdRef.current
      ) {
        return;
      }

      showToast(
        translateCommandPaletteMessage("dev_scenario_failed", {
          scenarioId,
          message: getUnknownErrorMessage(error),
        }),
      );
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
