import { normalizeSubscriptionCount } from "@/lib/subscriptions/subscription-count";

/**
 * Rolling window (in days) used to measure a feed's recent update frequency.
 *
 * Must stay in sync with the backend `RECENT_ARTICLE_ACTIVITY_WINDOW_DAYS`
 * (`src-tauri/src/domain/constants.rs`), which produces the raw
 * `recent_article_count` returned in `FeedArticleSummaryDto`.
 */
export const SUBSCRIPTION_UPDATE_FREQUENCY_WINDOW_DAYS = 30;

export const SUBSCRIPTION_OVERLOADED_RECENT_ARTICLE_THRESHOLD = 90;
export const SUBSCRIPTION_OVERLOADED_UNREAD_THRESHOLD = 100;

export function isOverloaded({
  postsLast30Days,
  unreadCount,
}: {
  postsLast30Days: number;
  unreadCount: number;
}): boolean {
  return (
    Math.floor(normalizeSubscriptionCount(postsLast30Days)) >= SUBSCRIPTION_OVERLOADED_RECENT_ARTICLE_THRESHOLD &&
    Math.floor(normalizeSubscriptionCount(unreadCount)) >= SUBSCRIPTION_OVERLOADED_UNREAD_THRESHOLD
  );
}

export type SubscriptionUpdatePace =
  | { unit: "day"; count: number }
  | { unit: "week"; count: number }
  | { unit: "none" };

export function resolveSubscriptionUpdatePace(recentArticleCount: number): SubscriptionUpdatePace {
  const count = Math.floor(normalizeSubscriptionCount(recentArticleCount));
  if (count === 0) {
    return { unit: "none" };
  }
  const perDay = count / SUBSCRIPTION_UPDATE_FREQUENCY_WINDOW_DAYS;
  if (perDay >= 1) {
    return { unit: "day", count: Math.round(perDay) };
  }
  return { unit: "week", count: Math.max(1, Math.round(perDay * 7)) };
}
