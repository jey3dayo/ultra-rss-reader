import { Result } from "@praha/byethrow";
import { useRef } from "react";
import { addToHistory } from "@/components/reader/hooks/command-palette/use-command-history";
import { type RuntimeDevScenario, runRuntimeDevScenario } from "@/dev/scenario-runtime";
import type { FeedLandingFailure, FeedLandingResult } from "@/hooks/use-feed-landing";
import { executeAction } from "@/lib/actions";
import i18n from "@/lib/i18n";
import type { ToastData } from "@/lib/ui/toast.types";
import enReader from "@/locales/en/reader.json";
import jaReader from "@/locales/ja/reader.json";
import type { PaletteAction } from "../../command-palette.types";
import { createCommandPaletteHistoryValue } from "../../command-palette-history";

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

function getFeedLandingFailureMessage(error: FeedLandingFailure) {
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
}: UseCommandPaletteHandlersParams): UseCommandPaletteHandlersResult {
  const feedLandingRequestIdRef = useRef(0);
  const selectedAccountIdRef = useRef(selectedAccountId);
  if (selectedAccountIdRef.current !== selectedAccountId) {
    selectedAccountIdRef.current = selectedAccountId;
    feedLandingRequestIdRef.current += 1;
  }

  function handleActionSelect(action: PaletteAction["id"]) {
    if (action === "open-shortcuts-help") {
      openShortcutsHelp();
      closePalette();
      return;
    }
    if (
      (!selectedAccountId && (action === "open-add-feed" || action === "sync-all" || action === "mark-all-read")) ||
      (isSyncing && action === "sync-all")
    ) {
      return;
    }

    addToHistory(createCommandPaletteHistoryValue({ kind: "action", id: action }));
    executeAction(action);
    closePalette();
  }

  function handleFeedSelect(feedId: string) {
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
