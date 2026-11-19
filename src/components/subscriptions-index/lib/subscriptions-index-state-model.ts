import type { SubscriptionListRow } from "@/lib/subscriptions/subscriptions-index.types";
import type {
  SubscriptionsWorkspaceExpandedGroupKey,
  SubscriptionsWorkspaceListScrollState,
} from "@/schemas/subscriptions-workspace";

const EXPANDED_GROUP_KEY_PREFIX = "group:";

export function findSelectedSubscriptionRow(
  rows: SubscriptionListRow[],
  selectedFeedId: string | null,
): SubscriptionListRow | null {
  return rows.find((row) => row.feed.id === selectedFeedId) ?? null;
}

export function addFeedIdToSet(current: ReadonlySet<string>, feedId: string): Set<string> {
  return new Set(current).add(feedId);
}

export function removeFeedIdsFromSet(current: ReadonlySet<string>, feedIds: Iterable<string>): Set<string> {
  const next = new Set(current);
  for (const feedId of feedIds) {
    next.delete(feedId);
  }
  return next;
}

export function removeFeedIdFromSet(current: ReadonlySet<string>, feedId: string): Set<string> {
  return removeFeedIdsFromSet(current, [feedId]);
}

export type VisibleRowsSnapshot = {
  feedIds: readonly string[];
  viewKey: string;
};

// A row that left the list under an unchanged filter/search hands the selection to its neighbour
// (next, else previous). Any other loss of the selection restarts from the first visible row.
export function resolveSelectionAfterRowsChange(params: {
  previous: VisibleRowsSnapshot | null;
  visibleFeedIds: readonly string[];
  viewKey: string;
  selectedFeedId: string | null;
}): string | null {
  const { previous, visibleFeedIds, viewKey, selectedFeedId } = params;
  if (previous !== null && previous.viewKey === viewKey && selectedFeedId !== null) {
    const removedIndex = previous.feedIds.indexOf(selectedFeedId);
    if (removedIndex >= 0) {
      const visible = new Set(visibleFeedIds);
      const next = previous.feedIds.slice(removedIndex + 1).find((feedId) => visible.has(feedId));
      const earlier = previous.feedIds.slice(0, removedIndex).findLast((feedId) => visible.has(feedId));
      return next ?? earlier ?? visibleFeedIds[0] ?? null;
    }
  }
  return visibleFeedIds[0] ?? null;
}

export function applySelectedFeedDecision(params: {
  selectedFeedId: string | null;
  primaryFeedIds: ReadonlySet<string>;
  secondaryFeedIds: ReadonlySet<string>;
}): {
  primaryFeedIds: Set<string>;
  secondaryFeedIds: Set<string>;
} | null {
  const { selectedFeedId, primaryFeedIds, secondaryFeedIds } = params;
  if (!selectedFeedId) {
    return null;
  }

  return {
    primaryFeedIds: addFeedIdToSet(primaryFeedIds, selectedFeedId),
    secondaryFeedIds: removeFeedIdFromSet(secondaryFeedIds, selectedFeedId),
  };
}

function namespaceExpandedGroupKey(groupKey: string): SubscriptionsWorkspaceExpandedGroupKey {
  return `${EXPANDED_GROUP_KEY_PREFIX}${groupKey}`;
}

function isExpandedGroupKey(groupKey: string): groupKey is SubscriptionsWorkspaceExpandedGroupKey {
  return groupKey.startsWith(EXPANDED_GROUP_KEY_PREFIX);
}

export function sanitizeExpandedGroups(
  expandedGroups: Record<string, boolean> | undefined,
): Record<SubscriptionsWorkspaceExpandedGroupKey, boolean> {
  if (!expandedGroups) {
    return {};
  }

  const sanitized: Record<SubscriptionsWorkspaceExpandedGroupKey, boolean> = {};
  for (const [groupKey, expanded] of Object.entries(expandedGroups)) {
    if (isExpandedGroupKey(groupKey) && typeof expanded === "boolean") {
      sanitized[groupKey] = expanded;
    }
  }
  return sanitized;
}

export function resolveGroupExpansion(
  expandedGroups: Record<SubscriptionsWorkspaceExpandedGroupKey, boolean>,
  groupKey: string,
): boolean {
  return expandedGroups[namespaceExpandedGroupKey(groupKey)] ?? true;
}

export function toggleExpandedGroup(
  expandedGroups: Record<SubscriptionsWorkspaceExpandedGroupKey, boolean>,
  groupKey: string,
): Record<SubscriptionsWorkspaceExpandedGroupKey, boolean> {
  const expandedGroupKey = namespaceExpandedGroupKey(groupKey);
  return {
    ...expandedGroups,
    [expandedGroupKey]: !(expandedGroups[expandedGroupKey] ?? true),
  };
}

export function resolveInitialListScrollState(params: {
  initialListScrollState?: SubscriptionsWorkspaceListScrollState;
  listLayoutGeneration: string;
  listLayoutReady: boolean;
  viewportHeight: number;
  viewportWidth?: number;
}): SubscriptionsWorkspaceListScrollState {
  const { initialListScrollState, listLayoutGeneration, listLayoutReady, viewportHeight, viewportWidth } = params;
  if (
    !initialListScrollState ||
    (listLayoutReady && initialListScrollState.layoutGeneration !== listLayoutGeneration) ||
    initialListScrollState.viewportHeight !== viewportHeight ||
    (initialListScrollState.viewportWidth !== undefined && initialListScrollState.viewportWidth !== viewportWidth) ||
    initialListScrollState.scrollTop < 0
  ) {
    return {
      scrollTop: 0,
      layoutGeneration: listLayoutGeneration,
      viewportHeight,
      ...(viewportWidth === undefined ? {} : { viewportWidth }),
    };
  }

  return initialListScrollState;
}

export function buildListLayoutGeneration(visibleRows: SubscriptionListRow[]): string {
  return visibleRows.map((row) => row.feed.id).join("\n");
}
