import type { CSSProperties, ReactNode, RefObject } from "react";
import type { FeedIntegrityIssueDto } from "@/api/schemas/feed-integrity";
import type { FeedDto, FolderDto } from "@/api/tauri-commands";
import type {
  BuildFeedCleanupCandidatesParams,
  FeedCleanupCandidate,
  FeedCleanupReasonKey,
  FeedCleanupSummaryKey,
  FeedCleanupTitleKey,
  FeedCleanupTone,
} from "@/lib/feed-cleanup";
import type { SubscriptionsWorkspace } from "@/stores/ui-store";
import type { FeedEditDisplayPreset } from "../reader/feed-edit-submit";
import type { FolderSelectViewProps } from "../reader/folder-select-view";
import type { SubscriptionDetailMetrics } from "../subscriptions-index/subscriptions-index.types";

export type FeedCleanupFilterOption = {
  key: "stale_90d" | "no_unread" | "no_stars";
  label: string;
};

export type FeedCleanupSummaryCard = {
  label: string;
  value: string;
  caption: string;
};

export type FeedCleanupCardProps = {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
};

export type FeedCleanupDetailRowProps = {
  label: ReactNode;
  value: ReactNode;
};

export type FeedCleanupIntegrityDetailLabels = {
  missing_feed_id: string;
  article_count: string;
  latest_article: string;
  latest_published_at: string;
  needs_repair: string;
  needs_repair_badge: string;
  summary: string;
  unknown_article: string;
  queue_item_title: string;
  queue_item_articles_label: string;
  filter_note: string;
};

export type FeedCleanupSelectedSummary = {
  tone: FeedCleanupTone;
  titleKey: FeedCleanupTitleKey;
  summaryKey: FeedCleanupSummaryKey;
};

export type FeedCleanupKeyboardHints = {
  moveLabel: string;
  moveKeys: string;
  selectLabel: string;
  selectKeys: string;
  reviewLabel: string;
  reviewKeys: string;
  keepKeys: string;
  deferKeys: string;
  deleteKeys: string;
};

export type FeedCleanupQueueCandidate = FeedCleanupCandidate & { deferred?: boolean };

export type FeedCleanupDecisionStatus = "review" | "keep" | "defer";

export type FeedCleanupLastDecisionAction = {
  decision: Exclude<FeedCleanupDecisionStatus, "review">;
  feedIds: string[];
  previousKeptFeedIds: string[];
  previousDeferredFeedIds: string[];
};

export type FeedCleanupOverviewPanelProps = {
  overviewLabel: string;
  filtersLabel: string;
  bulkActionsLabel: string;
  bulkVisibleCountLabel: string;
  allCandidateCount: number;
  bulkKeepVisibleLabel: string;
  bulkDeferVisibleLabel: string;
  summaryCards: ReadonlyArray<FeedCleanupSummaryCard>;
  integrityMode: boolean;
  integrityDetailLabels: FeedCleanupIntegrityDetailLabels;
  filterOptions: ReadonlyArray<FeedCleanupFilterOption>;
  filterCounts: Record<FeedCleanupFilterOption["key"], number>;
  activeFilterKeys: Set<FeedCleanupFilterOption["key"]>;
  visibleCandidateCount: number;
  showDeferred: boolean;
  showDeferredLabel: string;
  onToggleFilter: (key: FeedCleanupFilterOption["key"]) => void;
  onToggleShowDeferred: () => void;
  onKeepVisible: () => void;
  onDeferVisible: () => void;
};

export type FeedCleanupQueuePanelProps = {
  integrityMode: boolean;
  queueLabel: string;
  integrityQueueLabel: string;
  integrityEmptyLabel: string;
  integrityIssues: FeedIntegrityIssueDto[];
  selectedIntegrityIssue: FeedIntegrityIssueDto | null;
  integrityDetailLabels: FeedCleanupIntegrityDetailLabels;
  onSelectIntegrityIssue: (missingFeedId: string) => void;
  emptyLabel: string;
  queue: FeedCleanupQueueCandidate[];
  selectedCandidate: FeedCleanupQueueCandidate | null;
  selectedFeedIds?: ReadonlySet<string>;
  focusedFeedId?: string | null;
  onSelectCandidate: (candidateId: string) => void;
  onToggleCandidateSelection?: (candidateId: string) => void;
  bulkBarVisible?: boolean;
  selectedCountLabel?: string;
  selectCandidateLabel?: string;
  selectedStateLabel?: string;
  focusedStateLabel?: string;
  reviewStatusLabel?: string;
  deferredLabel?: string;
  keepLabel?: string;
  deleteLabel?: string;
  onKeepSelection?: () => void;
  onDeferSelection?: () => void;
  onDeleteSelection?: () => void;
  onKeepCandidate?: (candidateId: string) => void;
  onDeferCandidate?: (candidateId: string) => void;
  onDeleteCandidate?: (candidateId: string) => void;
  bulkSelectionScopeLabel?: string;
  bulkKeepActionLabel?: string;
  bulkDeferActionLabel?: string;
  bulkDeleteActionLabel?: string;
  keyboardHints?: FeedCleanupKeyboardHints;
  unreadCountLabel: string;
  starredCountLabel: string;
  deferredBadgeLabel: string;
  reasonLabels: Record<FeedCleanupReasonKey, string>;
  priorityToneLabels: Record<FeedCleanupTone, string>;
  summaryLabels: Record<FeedCleanupSummaryKey, string>;
  queueListClassName?: string;
};

export type FeedCleanupReviewPanelProps = {
  reviewLabel: string;
  integrityMode: boolean;
  dateLocale: string;
  integrityEmptyLabel: string;
  selectedIntegrityIssue: FeedIntegrityIssueDto | null;
  integrityDetailLabels: FeedCleanupIntegrityDetailLabels;
  selectedCandidate: FeedCleanupQueueCandidate | null;
  selectedFeed?: FeedDto | null;
  selectedMetrics?: SubscriptionDetailMetrics | null;
  selectedSummary: FeedCleanupSelectedSummary | null;
  currentStatusLabel?: string;
  currentStatusValue?: string;
  deferLabel?: string;
  folderLabel: string;
  latestArticleLabel: string;
  unreadCountLabel: string;
  starredCountLabel: string;
  reasonsLabel: string;
  noSelectionLabel: string;
  reasonLabels: Record<FeedCleanupReasonKey, string>;
  priorityToneLabels: Record<FeedCleanupTone, string>;
  priorityLabels: Record<FeedCleanupTitleKey, string>;
  summaryHeadlineLabels: Record<FeedCleanupTitleKey, string>;
  summaryLabels: Record<FeedCleanupSummaryKey, string>;
  editing: boolean;
  editor: ReactNode;
  reviewPanelClassName: string;
  editLabel: string;
  keepLabel?: string;
  laterLabel?: string;
  deleteLabel?: string;
  onEdit: () => void;
  onKeep?: () => void;
  onLater?: () => void;
  onDelete?: () => void;
  keyboardHints?: FeedCleanupKeyboardHints;
};

export type FeedCleanupPageViewProps = {
  title: string;
  subtitle: string;
  closeLabel: string;
  backToIndexLabel?: string;
  dateLocale: string;
  overviewLabel: string;
  filtersLabel: string;
  bulkActionsLabel: string;
  bulkVisibleCountLabel: string;
  allCandidateCount: number;
  bulkKeepVisibleLabel: string;
  bulkDeferVisibleLabel: string;
  queueLabel: string;
  bulkSelectionScopeLabel: string;
  bulkKeepActionLabel: string;
  bulkDeferActionLabel: string;
  bulkDeleteActionLabel: string;
  reviewLabel: string;
  summaryCards: ReadonlyArray<FeedCleanupSummaryCard>;
  integrityIssue: {
    title: string;
    body: string;
    actionLabel: string;
  } | null;
  integrityMode: boolean;
  integrityQueueLabel: string;
  integrityEmptyLabel: string;
  integrityIssues: FeedIntegrityIssueDto[];
  selectedIntegrityIssue: FeedIntegrityIssueDto | null;
  integrityDetailLabels: FeedCleanupIntegrityDetailLabels;
  filterOptions: ReadonlyArray<FeedCleanupFilterOption>;
  filterCounts: Record<FeedCleanupFilterOption["key"], number>;
  activeFilterKeys: Set<FeedCleanupFilterOption["key"]>;
  visibleCandidateCount: number;
  queue: FeedCleanupQueueCandidate[];
  selectedCandidate: FeedCleanupQueueCandidate | null;
  selectedFeed: FeedDto | null;
  selectedMetrics: SubscriptionDetailMetrics | null;
  selectedSummary: FeedCleanupSelectedSummary | null;
  showDeferred: boolean;
  showDeferredLabel: string;
  emptyLabel: string;
  keepLabel: string;
  laterLabel: string;
  currentStatusLabel: string;
  reviewStatusLabel: string;
  selectedCountLabel: string;
  selectCandidateLabel: string;
  selectedStateLabel: string;
  focusedStateLabel: string;
  deleteLabel: string;
  editLabel: string;
  folderLabel: string;
  latestArticleLabel: string;
  unreadCountLabel: string;
  starredCountLabel: string;
  reasonsLabel: string;
  noSelectionLabel: string;
  deferredBadgeLabel: string;
  reasonLabels: Record<FeedCleanupReasonKey, string>;
  priorityToneLabels: Record<FeedCleanupTone, string>;
  priorityLabels: Record<FeedCleanupTitleKey, string>;
  summaryHeadlineLabels: Record<FeedCleanupTitleKey, string>;
  summaryLabels: Record<FeedCleanupSummaryKey, string>;
  editing: boolean;
  editor: ReactNode;
  onBackToIndex?: () => void;
  onClose: () => void;
  onToggleIntegrityMode: () => void;
  onToggleFilter: (key: FeedCleanupFilterOption["key"]) => void;
  onToggleShowDeferred: () => void;
  onKeepVisible: () => void;
  onDeferVisible: () => void;
  onSelectCandidate: (candidateId: string) => void;
  onToggleCandidateSelection: (candidateId: string) => void;
  onSelectIntegrityIssue: (missingFeedId: string) => void;
  onMoveFocusNext: () => void;
  onMoveFocusPrevious: () => void;
  onKeepDecision: () => void;
  onDeferDecision: () => void;
  onDeleteDecision: () => void;
  onKeepCandidate: (candidateId: string) => void;
  onDeferCandidate: (candidateId: string) => void;
  onDeleteCandidate: (candidateId: string) => void;
  onSyncReviewToFocus: () => void;
  onEdit: () => void;
  selectedFeedIds: ReadonlySet<string>;
  focusedFeedId: string | null;
  currentStatusValue: string;
  keyboardHints: FeedCleanupKeyboardHints;
  suspendKeyboardShortcuts: boolean;
  shortcutsLabel: string;
  shortcutsTitle: string;
  shortcutsNavigationLabel: string;
  shortcutsActionsLabel: string;
  shortcutsHelpLabel: string;
  shortcutItems: ReadonlyArray<{
    key: string;
    label: string;
    category: "navigation" | "actions";
  }>;
};

export type FeedCleanupDeleteDialogProps = {
  candidates: FeedCleanupCandidate[];
  open: boolean;
  title: string;
  bulkTitle: string;
  bulkSummary: string;
  warningLabel: string;
  dateLocale: string;
  cancelLabel: string;
  deleteLabel: string;
  latestArticleLabel: string;
  unreadCountLabel: string;
  starredCountLabel: string;
  reasonsLabel: string;
  reasonLabels: Record<FeedCleanupCandidate["reasonKeys"][number], string>;
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
};

export type FeedCleanupFeedEditorProps = {
  feed: FeedDto;
  folders: FolderDto[];
  maintenanceTitle: string;
  maintenanceDescription: string;
  refetchLabel: string;
  unsubscribeLabel: string;
  onCancel: () => void;
  onDelete: () => void;
  onSaved: () => void;
};

export type FeedCleanupDisplayModeOption = {
  value: FeedEditDisplayPreset;
  label: string;
};

export type FeedCleanupFeedEditorControllerFolderSelectProps = {
  folderSelectValue: string;
  folderOptions: FolderSelectViewProps["options"];
  isCreatingFolder: boolean;
  newFolderName: string;
  newFolderInputRef: RefObject<HTMLInputElement | null>;
  handleFolderChange: (value: string) => void;
  setNewFolderName: (value: string) => void;
};

export type FeedCleanupFeedEditorControllerParams = {
  feed: FeedDto;
  folders: FolderDto[];
  onSaved: () => void;
};

export type FeedCleanupFeedEditorController = {
  title: string;
  displayPreset: FeedEditDisplayPreset;
  loading: boolean;
  refetching: boolean;
  displayModeOptions: readonly FeedCleanupDisplayModeOption[];
  setTitle: (value: string) => void;
  setDisplayPreset: (value: FeedEditDisplayPreset) => void;
  handleCopy: (value: string) => Promise<void>;
  handleSave: () => Promise<void>;
  handleRefetch: () => Promise<void>;
  folderSelectProps: FeedCleanupFeedEditorControllerFolderSelectProps;
};

export type FeedCleanupFilterKey = "stale_90d" | "no_unread" | "no_stars";

export type FeedCleanupPageInput = {
  subscriptionsWorkspace: SubscriptionsWorkspace | null;
  devIntent: string | null;
  feeds: BuildFeedCleanupCandidatesParams["feeds"];
  folders: BuildFeedCleanupCandidatesParams["folders"];
  accountArticles: BuildFeedCleanupCandidatesParams["articles"];
  integrityReport:
    | {
        orphaned_article_count: number;
        orphaned_feeds: FeedIntegrityIssueDto[];
      }
    | undefined;
};

export type FeedCleanupPageState = {
  activeFilters: Set<FeedCleanupFilterKey>;
  keptFeedIds: Set<string>;
  deferredFeedIds: Set<string>;
  showDeferred: boolean;
  selectedFeedId: string | null;
  focusedFeedId: string | null;
  selectedFeedIds: Set<string>;
  deleteTargetIds: string[];
  editingFeedId: string | null;
  queueMode: "cleanup" | "integrity";
  selectedIntegrityFeedId: string | null;
  lastDecisionAction: FeedCleanupLastDecisionAction | null;
};

export type FeedCleanupPageAction =
  | { type: "toggle-filter"; key: FeedCleanupFilterKey }
  | { type: "set-active-filters"; keys: FeedCleanupFilterKey[] }
  | { type: "toggle-show-deferred" }
  | { type: "set-selected-feed-id"; feedId: string | null }
  | { type: "set-focused-feed-id"; feedId: string | null }
  | { type: "toggle-selected-feed-id"; feedId: string }
  | { type: "clear-selected-feed-ids" }
  | { type: "set-selected-integrity-feed-id"; feedId: string | null }
  | { type: "toggle-queue-mode" }
  | { type: "set-queue-mode"; mode: FeedCleanupPageState["queueMode"] }
  | { type: "set-editing-feed-id"; feedId: string | null }
  | { type: "set-delete-target-ids"; feedIds: string[] }
  | { type: "apply-decision"; decision: Exclude<FeedCleanupDecisionStatus, "review">; feedIds: string[] }
  | { type: "undo-last-decision" }
  | { type: "delete-succeeded"; feedIds: string[] };
