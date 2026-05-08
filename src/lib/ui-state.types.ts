import type { ReaderSelection } from "@/lib/reader/reader-selection.types";
import type { SubscriptionSummaryFilterKey } from "@/lib/subscriptions/subscription-summary-filter.types";

export type ToastAction = {
  label: string;
  onClick: () => void;
};

export type ToastData = {
  message: string;
  persistent?: boolean;
  progress?: number | null;
  actions?: ToastAction[];
  variant?: "update";
};

export type SyncProgressStage = "started" | "account_started" | "account_finished" | "finished";
export type SyncProgressKind = "manual_all" | "manual_account" | "automatic";

export type SyncProgressEvent = {
  stage: SyncProgressStage;
  kind: SyncProgressKind;
  total: number;
  completed: number;
  account_id?: string | null;
  account_name?: string | null;
  success?: boolean | null;
};

export type SyncProgressState = {
  active: boolean;
  kind: SyncProgressKind | null;
  stage: SyncProgressStage | null;
  total: number;
  completed: number;
  currentAccountName: string | null;
  activeAccountIds: Set<string>;
};

export type AccountSetupSessionState = "syncing" | "failed" | "succeeded";

export type AccountSetupSession = {
  accountId: string;
  state: AccountSetupSessionState;
  errorMessage?: string;
};

export type UiSelection = ReaderSelection;

export type LayoutMode = "wide" | "compact" | "mobile";
export type FocusedPane = "sidebar" | "list" | "content";
export type ContentMode = "empty" | "reader" | "browser" | "loading";
export type PendingBrowserCloseAction = "prev-article" | "next-article" | "prev-feed" | "next-feed";
export type ArticleNavigationDirection = 1 | -1;

export type BrowserNavigationState = {
  canGoBack: boolean;
  canGoForward: boolean;
};

export type SubscriptionSummaryFilterState = SubscriptionSummaryFilterKey;

export type SubscriptionsWorkspaceReturnState = {
  activeSummaryFilter: SubscriptionSummaryFilterState;
  selectedFeedId: string | null;
  expandedGroups: Record<string, boolean>;
  listScrollTop: number;
  keptFeedIds: string[];
  deferredFeedIds: string[];
};

export type SubscriptionsWorkspace = {
  kind: "index";
  returnState?: SubscriptionsWorkspaceReturnState;
};

export type SettingsCategory =
  | "general"
  | "appearance"
  | "mute"
  | "reading"
  | "shortcuts"
  | "actions"
  | "data"
  | "debug"
  | "tags"
  | "accounts";
