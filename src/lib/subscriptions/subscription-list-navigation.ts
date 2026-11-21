/**
 * Resolves the feed next to `currentFeedId` in the displayed order.
 *
 * The caller owns which ids are navigable: collapsed groups and otherwise
 * hidden rows must already be excluded from `feedIds`. Movement stops at
 * both ends, so an edge, an unknown id, and a missing current id all
 * resolve to null.
 */
export function resolveAdjacentSubscriptionFeedId(
  feedIds: readonly string[],
  currentFeedId: string | null,
  direction: 1 | -1,
): string | null {
  if (currentFeedId === null) {
    return null;
  }
  const currentIndex = feedIds.indexOf(currentFeedId);
  if (currentIndex < 0) {
    return null;
  }
  return feedIds[currentIndex + direction] ?? null;
}
