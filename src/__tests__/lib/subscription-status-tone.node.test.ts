import { describe, expect, it } from "vitest";
import type { FeedDto } from "@/api/tauri-commands";
import {
  isSubscriptionReviewCandidate,
  type SubscriptionReviewCandidate,
  type SubscriptionReviewReasonKey,
} from "@/lib/subscriptions/subscription-review-candidates";
import { resolveFeedDetailTone, resolveSubscriptionStatusTone } from "@/lib/subscriptions/subscription-status-tone";
import {
  buildSubscriptionDetailCandidate,
  resolveSubscriptionRowStatus,
} from "@/lib/subscriptions/subscriptions-index";
import type { SubscriptionListRow } from "@/lib/subscriptions/subscriptions-index.types";

const feed = {
  id: "feed-1",
  account_id: "acc-1",
  folder_id: null,
  remote_id: null,
  title: "Feed",
  url: "https://example.com/feed.xml",
  site_url: "https://example.com",
  icon_url: null,
  unread_count: 3,
  reader_mode: "inherit",
  web_preview_mode: "inherit",
  created_at: null,
} satisfies FeedDto;

function buildCandidate(reasonKeys: SubscriptionReviewReasonKey[]): SubscriptionReviewCandidate {
  return {
    feedId: feed.id,
    title: feed.title,
    folderId: null,
    folderName: null,
    latestArticleAt: "2026-01-01T00:00:00Z",
    staleDays: 120,
    sinceCreatedDays: null,
    unreadCount: 3,
    starredCount: 0,
    reasonKeys,
  };
}

function buildDetailToneFor(candidate: SubscriptionReviewCandidate) {
  const status = resolveSubscriptionRowStatus({ candidate });
  const selectedRow = {
    feed,
    folderId: null,
    folderName: null,
    latestArticleAt: candidate.latestArticleAt,
    latestArticleDays: candidate.staleDays,
    inactiveDays: candidate.staleDays,
    recentArticleCount: 0,
    status,
    reasonTooltipKey: status.labelKey,
  } satisfies SubscriptionListRow;
  const detail = buildSubscriptionDetailCandidate({
    selectedRow,
    selectedCandidate: candidate,
    labels: {
      statusLabel: (labelKey) => labelKey,
      summaryText: (summaryKey) => summaryKey,
      reasonFact: (fact) => `${fact.key}:${fact.value}`,
      reasonLabel: (reasonKey) => reasonKey,
    },
  });
  return { status, detail };
}

describe("subscription review candidate predicate", () => {
  it("treats only stale and quiet reasons as review candidates", () => {
    expect(isSubscriptionReviewCandidate(buildCandidate([]))).toBe(false);
    expect(isSubscriptionReviewCandidate(buildCandidate(["attention_30d"]))).toBe(false);
    expect(isSubscriptionReviewCandidate(buildCandidate(["stale_90d"]))).toBe(true);
    expect(isSubscriptionReviewCandidate(buildCandidate(["quiet_no_unread"]))).toBe(true);
  });

  it("resolves a quiet-only candidate to the quiet row status", () => {
    expect(resolveSubscriptionRowStatus({ candidate: buildCandidate(["quiet_no_unread"]) })).toEqual({
      labelKey: "quiet_no_unread",
    });
  });
});

describe("subscription status tone", () => {
  it.each([
    ["normal", "neutral", "neutral"],
    ["attention_30d", "neutral", "neutral"],
    ["quiet_no_unread", "warning", "medium"],
    ["stale_90d", "danger", "high"],
  ] as const)("maps %s to the %s chip and the %s detail tone", (labelKey, chipTone, detailTone) => {
    expect(resolveSubscriptionStatusTone(labelKey)).toBe(chipTone);
    expect(resolveFeedDetailTone(resolveSubscriptionStatusTone(labelKey))).toBe(detailTone);
  });

  it.each([
    [[], "normal"],
    [["attention_30d"], "attention_30d"],
    [["stale_90d"], "stale_90d"],
    [["quiet_no_unread"], "quiet_no_unread"],
    [["stale_90d", "quiet_no_unread"], "stale_90d"],
  ] as const)("gives the detail pane the row's tone for reasons %j", (reasonKeys, labelKey) => {
    const { status, detail } = buildDetailToneFor(buildCandidate([...reasonKeys]));

    expect(status.labelKey).toBe(labelKey);
    expect(detail?.tone).toBe(resolveSubscriptionStatusTone(labelKey));
  });
});
