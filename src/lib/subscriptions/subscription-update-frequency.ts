import { normalizeSubscriptionCount } from "@/lib/subscriptions/subscription-count";

/**
 * Rolling window (in days) used to measure a feed's recent update frequency.
 *
 * Must stay in sync with the backend `RECENT_ARTICLE_ACTIVITY_WINDOW_DAYS`
 * (`src-tauri/src/domain/constants.rs`), which produces the raw
 * `recent_article_count` returned in `FeedArticleSummaryDto`.
 */
export const SUBSCRIPTION_UPDATE_FREQUENCY_WINDOW_DAYS = 30;

/**
 * Absolute article-count thresholds over the {@link SUBSCRIPTION_UPDATE_FREQUENCY_WINDOW_DAYS}
 * window. Derived from the real per-feed distribution of a 283-feed account:
 * `>= 10 / 30d` lands at ~p88 (roughly one article every three days), and
 * `>= 4 / 30d` at ~p75. Thresholds are absolute (not a live percentile) so a
 * feed's tier is a stable, explainable property rather than a ranking that
 * shifts as subscriptions are added or removed.
 */
export const SUBSCRIPTION_UPDATE_FREQUENCY_HIGH_THRESHOLD = 10;
export const SUBSCRIPTION_UPDATE_FREQUENCY_MEDIUM_THRESHOLD = 4;

export type SubscriptionUpdateFrequencyTier = "high" | "medium" | "low" | "none";

/**
 * Classify a feed's recent update frequency from its raw recent-window article
 * count. Non-finite or negative inputs normalize toward `"none"`.
 */
export function resolveSubscriptionUpdateFrequencyTier(recentArticleCount: number): SubscriptionUpdateFrequencyTier {
  const count = Math.floor(normalizeSubscriptionCount(recentArticleCount));

  if (count >= SUBSCRIPTION_UPDATE_FREQUENCY_HIGH_THRESHOLD) {
    return "high";
  }
  if (count >= SUBSCRIPTION_UPDATE_FREQUENCY_MEDIUM_THRESHOLD) {
    return "medium";
  }
  if (count >= 1) {
    return "low";
  }
  return "none";
}
