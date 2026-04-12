import type { Meta, StoryObj } from "@storybook/react-vite";
import { FeedCleanupQueuePanel } from "./feed-cleanup-queue-panel";

const meta = {
  title: "Feed Cleanup/QueuePanel",
  component: FeedCleanupQueuePanel,
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof FeedCleanupQueuePanel>;

export default meta;

type Story = StoryObj<typeof meta>;

const baseLabels = {
  queueLabel: "Cleanup Queue",
  integrityQueueLabel: "Broken references",
  integrityEmptyLabel: "No broken references found.",
  integrityDetailLabels: {
    missing_feed_id: "Missing feed ID",
    article_count: "Article count",
    latest_article: "Latest article",
    latest_published_at: "Latest published at",
    needs_repair: "Needs repair",
    needs_repair_badge: "Repair now",
    summary: "These articles reference a feed that no longer exists.",
    unknown_article: "Unknown article",
    queue_item_title: "Missing feed",
    queue_item_articles_label: "articles",
    filter_note: "Cleanup filters are hidden while you review broken references.",
  },
  emptyLabel: "No cleanup candidates right now.",
  unreadCountLabel: "Unread",
  starredCountLabel: "Starred",
  deferredBadgeLabel: "Deferred",
  reasonLabels: {
    stale_90d: "No new article for 90+ days",
    no_unread: "No unread articles",
    no_stars: "No starred articles",
  },
  priorityLabels: {
    review_now: "Review now",
    consider: "Consider",
    keep: "Keep",
  },
  summaryLabels: {
    stale_and_inactive: "90+ days quiet with no unread backlog.",
    stale_with_no_stars: "This feed is stale and has no saved articles.",
    inactive_without_signals: "No unread or starred articles are left here.",
    stale_but_supported: "The feed is quiet, but it may still matter.",
    healthy_feed: "This subscription still looks healthy.",
  },
  onSelectCandidate: () => {},
  onSelectIntegrityIssue: () => {},
} as const;

export const CleanupQueue: Story = {
  args: {
    ...baseLabels,
    integrityMode: false,
    integrityIssues: [],
    selectedIntegrityIssue: null,
    queue: [
      {
        feedId: "feed-1",
        title: "Old Product Blog",
        folderId: "folder-1",
        folderName: "Work",
        latestArticleAt: "2025-11-01T00:00:00.000Z",
        staleDays: 120,
        unreadCount: 0,
        starredCount: 0,
        reasonKeys: ["stale_90d", "no_unread", "no_stars"],
      },
      {
        feedId: "feed-2",
        title: "Quiet Vendor Updates",
        folderId: null,
        folderName: null,
        latestArticleAt: "2025-12-01T00:00:00.000Z",
        staleDays: 60,
        unreadCount: 0,
        starredCount: 0,
        reasonKeys: ["no_unread"],
        deferred: true,
      },
    ],
    selectedCandidate: {
      feedId: "feed-1",
      title: "Old Product Blog",
      folderId: "folder-1",
      folderName: "Work",
      latestArticleAt: "2025-11-01T00:00:00.000Z",
      staleDays: 120,
      unreadCount: 0,
      starredCount: 0,
      reasonKeys: ["stale_90d", "no_unread", "no_stars"],
    },
  },
};

export const IntegrityQueue: Story = {
  args: {
    ...baseLabels,
    integrityMode: true,
    integrityIssues: [
      {
        missing_feed_id: "missing-feed-42",
        article_count: 12,
        latest_article_title: "Broken reference article",
        latest_article_published_at: "2025-10-05T00:00:00.000Z",
      },
    ],
    selectedIntegrityIssue: {
      missing_feed_id: "missing-feed-42",
      article_count: 12,
      latest_article_title: "Broken reference article",
      latest_article_published_at: "2025-10-05T00:00:00.000Z",
    },
    queue: [],
    selectedCandidate: null,
  },
};
