import type { ReaderSelection } from "@/lib/reader/reader-selection.types";
import type { ViewMode } from "@/lib/view-mode.types";

export type ReaderFilter = ViewMode;

export type ReaderQuerySelection = ReaderSelection;

export type AccountReaderScope = { type: "account"; accountId: string };
export type ArticleReaderScope =
  | AccountReaderScope
  | { type: "feed"; feedId: string }
  | { type: "folder"; folderId: string }
  | { type: "tag"; tagId: string };

export type ReaderQuery =
  | { source: "articles"; scope: ArticleReaderScope; filter: ReaderFilter }
  | { source: "recent"; scope: AccountReaderScope; filter: ReaderFilter };

export type ReaderSourceKind = "none" | "account" | "folder" | "feed" | "tag" | "recent";

export type ReaderSourcePlan = {
  query: ReaderQuery | null;
  sourceKind: ReaderSourceKind;
  sourceKey: string;
  accountId: string | null;
  folderId: string | null;
  feedId: string | null;
  tagId: string | null;
  accountMode: ReaderFilter;
  folderMode: ReaderFilter;
  feedMode: ReaderFilter;
  tagMode: ReaderFilter;
  recentMode: ReaderFilter;
  effectiveViewMode: ReaderFilter;
  preservesRecentOrder: boolean;
};

function resolveEffectiveViewMode(
  selection: ReaderQuerySelection,
  viewMode: ReaderFilter,
  query: ReaderQuery,
): ReaderFilter {
  if (selection.type === "smart" && selection.kind === "unread") {
    return "unread";
  }

  if (selection.type === "smart" && selection.kind === "starred") {
    return viewMode === "unread" ? "unread" : "all";
  }

  return query.filter;
}

// ReaderQuery represents only the user's reader intent. Paging, sorting, API
// choice, labels, and focus handling stay in their own layers.
export function resolveReaderQuery(
  selection: ReaderQuerySelection,
  viewMode: ReaderFilter,
  selectedAccountId: string | null,
): ReaderQuery | null {
  if (selectedAccountId === null) {
    return null;
  }

  if (selection.type === "smart") {
    if (selection.kind === "recent") {
      return {
        source: "recent",
        scope: { type: "account", accountId: selectedAccountId },
        filter: viewMode,
      };
    }

    return {
      source: "articles",
      scope: { type: "account", accountId: selectedAccountId },
      filter: selection.kind,
    };
  }

  if (selection.type === "feed") {
    return {
      source: "articles",
      scope: { type: "feed", feedId: selection.feedId },
      filter: viewMode,
    };
  }

  if (selection.type === "folder") {
    return {
      source: "articles",
      scope: { type: "folder", folderId: selection.folderId },
      filter: viewMode,
    };
  }

  if (selection.type === "tag") {
    return {
      source: "articles",
      scope: { type: "tag", tagId: selection.tagId },
      filter: viewMode,
    };
  }

  return {
    source: "articles",
    scope: { type: "account", accountId: selectedAccountId },
    filter: viewMode,
  };
}

function buildDisabledReaderSourcePlan(viewMode: ReaderFilter): ReaderSourcePlan {
  return {
    query: null,
    sourceKind: "none",
    sourceKey: "none",
    accountId: null,
    folderId: null,
    feedId: null,
    tagId: null,
    accountMode: "all",
    folderMode: "all",
    feedMode: "all",
    tagMode: "all",
    recentMode: "all",
    effectiveViewMode: viewMode,
    preservesRecentOrder: false,
  };
}

export function resolveReaderSourcePlan(
  selection: ReaderQuerySelection,
  viewMode: ReaderFilter,
  selectedAccountId: string | null,
): ReaderSourcePlan {
  const query = resolveReaderQuery(selection, viewMode, selectedAccountId);
  if (query === null) {
    return buildDisabledReaderSourcePlan(viewMode);
  }
  const effectiveViewMode = resolveEffectiveViewMode(selection, viewMode, query);

  if (query.source === "recent") {
    return {
      query,
      sourceKind: "recent",
      sourceKey: `recent:${query.scope.accountId}:${query.filter}`,
      accountId: query.scope.accountId,
      folderId: null,
      feedId: null,
      tagId: null,
      accountMode: "all",
      folderMode: "all",
      feedMode: "all",
      tagMode: "all",
      recentMode: query.filter,
      effectiveViewMode,
      preservesRecentOrder: true,
    };
  }

  if (query.scope.type === "account") {
    return {
      query,
      sourceKind: "account",
      sourceKey: `account:${query.scope.accountId}:articles:${query.filter}`,
      accountId: query.scope.accountId,
      folderId: null,
      feedId: null,
      tagId: null,
      accountMode: query.filter,
      folderMode: "all",
      feedMode: "all",
      tagMode: "all",
      recentMode: "all",
      effectiveViewMode,
      preservesRecentOrder: false,
    };
  }

  if (query.scope.type === "folder") {
    return {
      query,
      sourceKind: "folder",
      sourceKey: `folder:${query.scope.folderId}:${query.filter}`,
      accountId: null,
      folderId: query.scope.folderId,
      feedId: null,
      tagId: null,
      accountMode: "all",
      folderMode: query.filter,
      feedMode: "all",
      tagMode: "all",
      recentMode: "all",
      effectiveViewMode,
      preservesRecentOrder: false,
    };
  }

  if (query.scope.type === "feed") {
    return {
      query,
      sourceKind: "feed",
      sourceKey: `feed:${query.scope.feedId}:${query.filter}`,
      accountId: null,
      folderId: null,
      feedId: query.scope.feedId,
      tagId: null,
      accountMode: "all",
      folderMode: "all",
      feedMode: query.filter,
      tagMode: "all",
      recentMode: "all",
      effectiveViewMode,
      preservesRecentOrder: false,
    };
  }

  return {
    query,
    sourceKind: "tag",
    sourceKey: `tag:${query.scope.tagId}:${query.filter}`,
    accountId: null,
    folderId: null,
    feedId: null,
    tagId: query.scope.tagId,
    accountMode: "all",
    folderMode: "all",
    feedMode: "all",
    tagMode: query.filter,
    recentMode: "all",
    effectiveViewMode,
    preservesRecentOrder: false,
  };
}
