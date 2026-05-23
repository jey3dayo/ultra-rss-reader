export function normalizeSubscriptionCount(count: number): number {
  return Number.isFinite(count) ? Math.max(0, count) : 0;
}
