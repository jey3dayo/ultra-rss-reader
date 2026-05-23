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

export function removeFeedIdFromSet(current: ReadonlySet<string>, feedId: string): Set<string> {
  const next = new Set(current);
  next.delete(feedId);
  return next;
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
}): SubscriptionsWorkspaceListScrollState {
  const { initialListScrollState, listLayoutGeneration, listLayoutReady, viewportHeight } = params;
  if (
    !initialListScrollState ||
    (listLayoutReady && initialListScrollState.layoutGeneration !== listLayoutGeneration) ||
    initialListScrollState.viewportHeight !== viewportHeight ||
    initialListScrollState.scrollTop < 0
  ) {
    return {
      scrollTop: 0,
      layoutGeneration: listLayoutGeneration,
      viewportHeight,
    };
  }

  return initialListScrollState;
}

export function buildListLayoutGeneration(visibleRows: SubscriptionListRow[]): string {
  return visibleRows.map((row) => row.feed.id).join("\n");
}
