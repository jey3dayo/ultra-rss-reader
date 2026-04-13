import { Result } from "@praha/byethrow";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useReducer, useRef } from "react";
import { useTranslation } from "react-i18next";
import { addLocalFeed, discoverFeeds, updateFeedFolder } from "@/api/tauri-commands";
import { useUiStore } from "@/stores/ui-store";
import type { AddFeedDialogAction, AddFeedDialogState } from "./add-feed-dialog.types";
import { createFolderIfNeeded } from "./feed-folder-flow";
import { buildFolderOptions, useFolderSelection } from "./use-folder-selection";

function createInitialState(): AddFeedDialogState {
  return {
    url: "",
    error: null,
    successMessage: null,
    loading: false,
    discovering: false,
    discoveredFeeds: [],
    selectedFeedUrl: null,
  };
}

function reducer(state: AddFeedDialogState, action: AddFeedDialogAction): AddFeedDialogState {
  switch (action.type) {
    case "reset":
      return createInitialState();
    case "set-url":
      return {
        ...state,
        url: action.url,
        discoveredFeeds: [],
        selectedFeedUrl: null,
      };
    case "start-discover":
      return {
        ...state,
        discovering: true,
        error: null,
        successMessage: null,
        discoveredFeeds: [],
        selectedFeedUrl: null,
      };
    case "discover-empty":
      return {
        ...state,
        discovering: false,
        discoveredFeeds: [],
        selectedFeedUrl: null,
        successMessage: "feed_url_ready",
      };
    case "discover-single":
      return {
        ...state,
        discovering: false,
        discoveredFeeds: action.feeds[0]?.title ? action.feeds : [],
        selectedFeedUrl: action.feeds[0]?.url ?? null,
        successMessage: "feed_detected",
      };
    case "discover-multiple":
      return {
        ...state,
        discovering: false,
        discoveredFeeds: action.feeds,
        selectedFeedUrl: action.feeds[0]?.url ?? null,
      };
    case "discover-error":
      return {
        ...state,
        discovering: false,
        error: action.error,
      };
    case "set-selected-feed-url":
      return {
        ...state,
        selectedFeedUrl: action.url,
      };
    case "set-invalid-url-error":
      return {
        ...state,
        error: action.error,
        successMessage: null,
      };
    case "set-loading":
      return {
        ...state,
        loading: action.loading,
        ...(action.loading ? { error: null } : {}),
      };
    case "set-submit-error":
      return {
        ...state,
        loading: false,
        error: action.error,
      };
    default:
      return state;
  }
}

function isValidFeedUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function useAddFeedDialogController({
  open,
  onOpenChange,
  accountId,
  folders,
  noFolderLabel,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string;
  folders: Array<{ id: string; account_id: string; name: string; sort_order: number }> | undefined;
  noFolderLabel: string;
}) {
  const { t } = useTranslation("reader");
  const [state, dispatch] = useReducer(reducer, undefined, createInitialState);
  const inputRef = useRef<HTMLInputElement>(null);
  const {
    selectedFolderId,
    newFolderName,
    isCreatingFolder,
    newFolderInputRef,
    folderSelectValue,
    handleFolderChange,
    resetFolderSelection,
    setNewFolderName,
  } = useFolderSelection(null);
  const qc = useQueryClient();
  const showToast = useUiStore((s) => s.showToast);

  useEffect(() => {
    if (!open) {
      return;
    }

    dispatch({ type: "reset" });
    resetFolderSelection(null);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [open, resetFolderSelection]);

  const trimmedUrl = state.url.trim();
  const hasManualUrl = trimmedUrl.length > 0;
  const isManualUrlValid = !hasManualUrl || isValidFeedUrl(trimmedUrl);
  const urlHint =
    hasManualUrl && !isManualUrlValid ? t("feed_url_help_invalid") : hasManualUrl ? null : t("feed_url_help_example");
  const urlHintTone = hasManualUrl && !isManualUrlValid ? "error" : "muted";

  const handleDiscover = async () => {
    if (!hasManualUrl || !isManualUrlValid) {
      dispatch({ type: "set-invalid-url-error", error: t("invalid_feed_url") });
      return;
    }

    dispatch({ type: "start-discover" });

    Result.pipe(
      await discoverFeeds(trimmedUrl),
      Result.inspect((feeds) => {
        if (feeds.length === 0) {
          dispatch({ type: "discover-empty" });
        } else if (feeds.length === 1) {
          dispatch({ type: "discover-single", feeds });
        } else {
          dispatch({ type: "discover-multiple", feeds });
        }
      }),
      Result.inspectError((e) => {
        dispatch({ type: "discover-error", error: t("discovery_failed", { message: e.message }) });
      }),
    );
  };

  const getFeedUrl = () => state.selectedFeedUrl ?? state.url.trim();

  const handleSubmit = async () => {
    const feedUrl = getFeedUrl();
    if (!feedUrl) {
      return;
    }

    if (!state.selectedFeedUrl && !isValidFeedUrl(feedUrl)) {
      dispatch({ type: "set-submit-error", error: t("invalid_feed_url") });
      return;
    }

    dispatch({ type: "set-loading", loading: true });

    const folderId = await createFolderIfNeeded({
      accountId,
      selectedFolderId,
      isCreatingFolder,
      newFolderName,
      onError: (error) => {
        const message = t("failed_to_create_folder", { message: error.message });
        dispatch({ type: "set-submit-error", error: message });
        showToast(message);
      },
    });
    if (folderId === undefined) {
      dispatch({ type: "set-loading", loading: false });
      return;
    }

    let feedId: string | null = null;
    let hasError = false;

    Result.pipe(
      await addLocalFeed(accountId, feedUrl),
      Result.inspect((feed) => {
        feedId = feed.id;
      }),
      Result.inspectError((e) => {
        hasError = true;
        dispatch({ type: "set-submit-error", error: t("failed_to_add_feed", { message: e.message }) });
      }),
    );

    if (hasError) {
      return;
    }

    if (folderId && feedId) {
      Result.pipe(
        await updateFeedFolder(feedId, folderId),
        Result.inspectError((e) => {
          console.error("Failed to assign folder:", e);
          showToast(t("feed_added_folder_failed", { message: e.message }));
        }),
      );
    }

    qc.invalidateQueries({ queryKey: ["feeds"] });
    qc.invalidateQueries({ queryKey: ["accountUnreadCount"] });
    qc.invalidateQueries({ queryKey: ["folders"] });
    onOpenChange(false);
    dispatch({ type: "set-loading", loading: false });
  };

  return {
    inputRef,
    url: state.url,
    error: state.error,
    successMessage:
      state.successMessage === "feed_url_ready"
        ? t("feed_url_ready")
        : state.successMessage === "feed_detected"
          ? t("feed_detected")
          : null,
    loading: state.loading,
    discovering: state.discovering,
    discoveredFeeds: state.discoveredFeeds,
    selectedFeedUrl: state.selectedFeedUrl,
    setUrl: (url: string) => dispatch({ type: "set-url", url }),
    setSelectedFeedUrl: (url: string | null) => dispatch({ type: "set-selected-feed-url", url }),
    handleDiscover,
    handleSubmit,
    folderSelectProps: {
      selectedFolderId,
      newFolderName,
      isCreatingFolder,
      newFolderInputRef,
      folderSelectValue,
      handleFolderChange,
      setNewFolderName,
      folderOptions: buildFolderOptions(folders, noFolderLabel),
    },
    derived: {
      hasManualUrl,
      isManualUrlValid,
      urlHint,
      urlHintTone,
      isSubmitDisabled:
        (!state.selectedFeedUrl && (!hasManualUrl || !isManualUrlValid)) ||
        state.loading ||
        state.discovering ||
        (isCreatingFolder && !newFolderName.trim()),
      isDiscoverDisabled: !hasManualUrl || !isManualUrlValid || state.loading || state.discovering,
      discoveredFeedOptions: state.discoveredFeeds.map((feed) => ({
        value: feed.url,
        label: feed.title || feed.url,
      })),
    },
  } as const;
}
