import type { SubscriptionRowStatus, SubscriptionStatusTone } from "@/lib/subscriptions/subscriptions-index.types";

const STATUS_TONE_BY_LABEL_KEY = {
  normal: "neutral",
  attention_30d: "neutral",
  quiet_no_unread: "warning",
  stale_90d: "danger",
  no_articles: "warning",
} as const satisfies Record<SubscriptionRowStatus["labelKey"], SubscriptionStatusTone>;

const FEED_DETAIL_TONE_BY_STATUS_TONE = {
  neutral: "neutral",
  warning: "medium",
  danger: "high",
} as const satisfies Record<SubscriptionStatusTone, "neutral" | "medium" | "high">;

export function resolveSubscriptionStatusTone(labelKey: SubscriptionRowStatus["labelKey"]): SubscriptionStatusTone {
  return STATUS_TONE_BY_LABEL_KEY[labelKey];
}

export function resolveFeedDetailTone(tone: SubscriptionStatusTone) {
  return FEED_DETAIL_TONE_BY_STATUS_TONE[tone];
}
