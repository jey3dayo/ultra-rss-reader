import type { DiscoveredFeedDto } from "@/api/tauri-commands";
import type { AddFeedDialogAction, AddFeedDialogControllerDerived, AddFeedDialogState } from "./add-feed-dialog.types";

export function createInitialAddFeedDialogState(): AddFeedDialogState {
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

export function addFeedDialogReducer(state: AddFeedDialogState, action: AddFeedDialogAction): AddFeedDialogState {
  switch (action.type) {
    case "reset":
      return createInitialAddFeedDialogState();
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

export function isValidFeedUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

type ResolveAddFeedDialogDerivedParams = {
  state: AddFeedDialogState;
  isCreatingFolder: boolean;
  newFolderName: string;
  invalidUrlHint: string;
  exampleUrlHint: string;
};

function buildDiscoveredFeedOptions(feeds: DiscoveredFeedDto[]) {
  return feeds.map((feed) => ({
    value: feed.url,
    label: feed.title || feed.url,
  }));
}

export function resolveAddFeedDialogDerived({
  state,
  isCreatingFolder,
  newFolderName,
  invalidUrlHint,
  exampleUrlHint,
}: ResolveAddFeedDialogDerivedParams): AddFeedDialogControllerDerived {
  const trimmedUrl = state.url.trim();
  const hasManualUrl = trimmedUrl.length > 0;
  const isManualUrlValid = !hasManualUrl || isValidFeedUrl(trimmedUrl);

  return {
    hasManualUrl,
    isManualUrlValid,
    urlHint: hasManualUrl && !isManualUrlValid ? invalidUrlHint : hasManualUrl ? null : exampleUrlHint,
    urlHintTone: hasManualUrl && !isManualUrlValid ? "error" : "muted",
    isSubmitDisabled:
      (!state.selectedFeedUrl && (!hasManualUrl || !isManualUrlValid)) ||
      state.loading ||
      state.discovering ||
      (isCreatingFolder && !newFolderName.trim()),
    isDiscoverDisabled: !hasManualUrl || !isManualUrlValid || state.loading || state.discovering,
    discoveredFeedOptions: buildDiscoveredFeedOptions(state.discoveredFeeds),
  };
}
