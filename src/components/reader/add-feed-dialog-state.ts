import type { DiscoveredFeedDto } from "@/api/tauri-commands";
import type {
  AddFeedDialogAction,
  AddFeedDialogControllerDerived,
  AddFeedDialogState,
  ResolveAddFeedDialogDerivedParams,
} from "./add-feed-dialog.types";

export function createInitialAddFeedDialogState(): AddFeedDialogState {
  return {
    url: "",
    error: null,
    successMessage: null,
    loading: false,
    discovering: false,
    discoveryRequestId: null,
    discoveredFeeds: [],
    selectedFeedUrl: null,
  };
}

function isStaleDiscoveryAction(state: AddFeedDialogState, requestId: number | undefined): boolean {
  return requestId !== undefined && state.discoveryRequestId !== requestId;
}

type AddFeedDialogActionType = AddFeedDialogAction["type"];
type AddFeedDialogActionOf<T extends AddFeedDialogActionType> = Extract<AddFeedDialogAction, { type: T }>;
type AddFeedDialogActionReducer<T extends AddFeedDialogActionType> = (
  state: AddFeedDialogState,
  action: AddFeedDialogActionOf<T>,
) => AddFeedDialogState;
type DiscoveryResultActionType = "discover-empty" | "discover-single" | "discover-multiple" | "discover-error";

function ignoreStaleDiscovery<T extends DiscoveryResultActionType>(
  reduce: AddFeedDialogActionReducer<T>,
): AddFeedDialogActionReducer<T> {
  return (state, action) => {
    const { requestId } = action as { requestId?: number };
    return isStaleDiscoveryAction(state, requestId) ? state : reduce(state, action);
  };
}

const addFeedDialogActionReducers: { [T in AddFeedDialogActionType]: AddFeedDialogActionReducer<T> } = {
  reset: () => createInitialAddFeedDialogState(),
  "set-url": (state, action) => ({
    ...state,
    url: action.url,
    discovering: false,
    discoveryRequestId: null,
    discoveredFeeds: [],
    selectedFeedUrl: null,
  }),
  "start-discover": (state, action) => ({
    ...state,
    discovering: true,
    discoveryRequestId: action.requestId ?? null,
    error: null,
    successMessage: null,
    discoveredFeeds: [],
    selectedFeedUrl: null,
  }),
  "discover-empty": ignoreStaleDiscovery((state) => ({
    ...state,
    discovering: false,
    discoveryRequestId: null,
    discoveredFeeds: [],
    selectedFeedUrl: null,
    successMessage: "feed_url_ready",
  })),
  "discover-single": ignoreStaleDiscovery((state, action) => ({
    ...state,
    discovering: false,
    discoveryRequestId: null,
    discoveredFeeds: action.feeds[0] && hasDiscoveredFeedTitle(action.feeds[0]) ? action.feeds : [],
    selectedFeedUrl: action.feeds[0]?.url ?? null,
    successMessage: "feed_detected",
  })),
  "discover-multiple": ignoreStaleDiscovery((state, action) => ({
    ...state,
    discovering: false,
    discoveryRequestId: null,
    discoveredFeeds: action.feeds,
    selectedFeedUrl: action.feeds[0]?.url ?? null,
  })),
  "discover-error": ignoreStaleDiscovery((state, action) => ({
    ...state,
    discovering: false,
    discoveryRequestId: null,
    error: action.error,
  })),
  "set-selected-feed-url": (state, action) => ({
    ...state,
    selectedFeedUrl: action.url,
  }),
  "set-invalid-url-error": (state, action) => ({
    ...state,
    error: action.error,
    successMessage: null,
  }),
  "set-loading": (state, action) => ({
    ...state,
    loading: action.loading,
    ...(action.loading ? { error: null } : {}),
  }),
  "set-submit-error": (state, action) => ({
    ...state,
    loading: false,
    error: action.error,
  }),
};

export function addFeedDialogReducer(state: AddFeedDialogState, action: AddFeedDialogAction): AddFeedDialogState {
  if (!Object.hasOwn(addFeedDialogActionReducers, action.type)) {
    return state;
  }
  const reduce = addFeedDialogActionReducers[action.type] as AddFeedDialogActionReducer<typeof action.type>;
  return reduce(state, action);
}

export function isValidFeedUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function buildFeedDescription(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.host}${parsed.pathname}`;
  } catch {
    return url;
  }
}

function getDiscoveredFeedLabel(feed: DiscoveredFeedDto): string {
  const title = feed.title.trim();
  return title.length > 0 ? title : feed.url;
}

function hasDiscoveredFeedTitle(feed: DiscoveredFeedDto): boolean {
  return feed.title.trim().length > 0;
}

function buildDiscoveredFeedOptions(feeds: DiscoveredFeedDto[]) {
  const labelCounts = new Map<string, number>();
  for (const feed of feeds) {
    const label = getDiscoveredFeedLabel(feed);
    labelCounts.set(label, (labelCounts.get(label) ?? 0) + 1);
  }

  return feeds.map((feed) => {
    const label = getDiscoveredFeedLabel(feed);
    return {
      value: feed.url,
      label,
      description: (labelCounts.get(label) ?? 0) > 1 ? buildFeedDescription(feed.url) : undefined,
    };
  });
}

export function resolveAddFeedDialogDerived({
  state,
  folderSelection,
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
      (folderSelection.isCreatingFolder && !folderSelection.newFolderName.trim()),
    isDiscoverDisabled: !hasManualUrl || !isManualUrlValid || state.loading || state.discovering,
    discoveredFeedOptions: buildDiscoveredFeedOptions(state.discoveredFeeds),
  };
}
