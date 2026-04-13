import type { ReactNode, RefObject } from "react";
import type { FeedIntegrityIssueDto } from "@/api/schemas/feed-integrity";
import type { FeedDto, FolderDto } from "@/api/tauri-commands";
import type {
  FeedCleanupCandidate,
  FeedCleanupReasonKey,
  FeedCleanupSummaryKey,
  FeedCleanupTitleKey,
  FeedCleanupTone,
} from "@/lib/feed-cleanup";
import type { FeedEditDisplayPreset } from "../reader/feed-edit-submit";
import type { FolderSelectViewProps } from "../reader/folder-select-view";

export type FeedCleanupFilterOption = {
  key: "stale_90d" | "no_unread" | "no_stars";
  label: string;
};

export type FeedCleanupSummaryCard = {
  label: string;
  value: string;
  caption: string;
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

export type FeedCleanupQueueCandidate = FeedCleanupCandidate & { deferred?: boolean };

export type FeedCleanupOverviewPanelProps = {
  overviewLabel: string;
  filtersLabel: string;
  bulkActionsLabel: string;
  bulkVisibleCountLabel: string;
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
  onSelectCandidate: (candidateId: string) => void;
  unreadCountLabel: string;
  starredCountLabel: string;
  deferredBadgeLabel: string;
  reasonLabels: Record<FeedCleanupReasonKey, string>;
  priorityToneLabels: Record<FeedCleanupTone, string>;
  summaryLabels: Record<FeedCleanupSummaryKey, string>;
};

export type FeedCleanupReviewPanelProps = {
  reviewLabel: string;
  integrityMode: boolean;
  dateLocale: string;
  integrityEmptyLabel: string;
  selectedIntegrityIssue: FeedIntegrityIssueDto | null;
  integrityDetailLabels: FeedCleanupIntegrityDetailLabels;
  selectedCandidate: FeedCleanupQueueCandidate | null;
  selectedSummary: FeedCleanupSelectedSummary | null;
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
  keepLabel: string;
  laterLabel: string;
  deleteLabel: string;
  onEdit: () => void;
  onKeep: () => void;
  onLater: () => void;
  onDelete: () => void;
};

export type FeedCleanupPageViewProps = {
  title: string;
  subtitle: string;
  closeLabel: string;
  dateLocale: string;
  overviewLabel: string;
  filtersLabel: string;
  bulkActionsLabel: string;
  bulkVisibleCountLabel: string;
  bulkKeepVisibleLabel: string;
  bulkDeferVisibleLabel: string;
  queueLabel: string;
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
  selectedSummary: FeedCleanupSelectedSummary | null;
  showDeferred: boolean;
  showDeferredLabel: string;
  emptyLabel: string;
  keepLabel: string;
  laterLabel: string;
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
  onClose: () => void;
  onToggleIntegrityMode: () => void;
  onToggleFilter: (key: FeedCleanupFilterOption["key"]) => void;
  onToggleShowDeferred: () => void;
  onKeepVisible: () => void;
  onDeferVisible: () => void;
  onSelectCandidate: (candidateId: string) => void;
  onSelectIntegrityIssue: (missingFeedId: string) => void;
  onEdit: () => void;
  onKeep: () => void;
  onLater: () => void;
  onDelete: () => void;
};

export type FeedCleanupDeleteDialogProps = {
  candidate: FeedCleanupCandidate | null;
  open: boolean;
  title: string;
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
