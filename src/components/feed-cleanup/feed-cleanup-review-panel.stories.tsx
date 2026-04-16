import type { Meta, StoryObj } from "@storybook/react-vite";
import { FeedCleanupReviewPanel } from "./feed-cleanup-review-panel";

const meta = {
  title: "Feed Cleanup/ReviewPanel",
  component: FeedCleanupReviewPanel,
  parameters: {
    layout: "fullscreen",
  },
  decorators: [
    (Story) => (
      <div className="mx-auto w-full max-w-[420px] border border-border/70 bg-background">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof FeedCleanupReviewPanel>;

export default meta;

type Story = StoryObj<typeof meta>;

const baseLabels = {
  reviewLabel: "Review",
  dateLocale: "en-US",
  integrityEmptyLabel: "No integrity issues selected.",
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
    filter_note: "Integrity mode is active.",
  },
  folderLabel: "Folder",
  latestArticleLabel: "Latest article",
  unreadCountLabel: "Unread",
  starredCountLabel: "Starred",
  reasonsLabel: "Why this feed is here",
  noSelectionLabel: "Select a feed to review.",
  reasonLabels: {
    stale_90d: "No new article for 90+ days",
    no_unread: "No unread",
    no_stars: "No stars",
  },
  priorityToneLabels: {
    high: "High priority",
    medium: "Medium priority",
    low: "Low priority",
  },
  priorityLabels: {
    review_now: "Review now",
    consider: "Consider",
    keep: "Keep",
  },
  summaryHeadlineLabels: {
    review_now: "Strong cleanup candidate",
    consider: "Worth a quick check",
    keep: "Looks healthy",
  },
  summaryLabels: {
    stale_and_inactive: "90+ days quiet with no unread backlog.",
    stale_with_no_stars: "This feed is stale and has no saved articles.",
    inactive_without_signals: "No unread or starred articles are left here.",
    stale_but_supported: "The feed is quiet, but it may still matter.",
    healthy_feed: "This subscription still looks healthy.",
  },
  reviewPanelClassName: "w-full max-w-[380px]",
  editLabel: "Edit Feed",
  keepLabel: "Keep",
  laterLabel: "Defer",
  currentStatusLabel: "Current status",
  currentStatusValue: "Review",
  deferLabel: "Defer",
  deleteLabel: "Delete",
  onEdit: () => {},
  onKeep: () => {},
  onLater: () => {},
  onDelete: () => {},
} as const;

export const CandidateReview: Story = {
  args: {
    ...baseLabels,
    integrityMode: false,
    selectedIntegrityIssue: null,
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
    selectedSummary: {
      tone: "high",
      titleKey: "review_now",
      summaryKey: "stale_and_inactive",
    },
    selectedFeed: {
      id: "feed-1",
      account_id: "acc-1",
      folder_id: "folder-1",
      title: "Old Product Blog",
      url: "https://example.com/feed.xml",
      site_url: "https://example.com",
      unread_count: 0,
      reader_mode: "inherit",
      web_preview_mode: "inherit",
    },
    selectedMetrics: {
      latestArticleAt: "2025-11-01T00:00:00.000Z",
      starredCount: 0,
      previewArticles: [
        {
          id: "art-1",
          feed_id: "feed-1",
          title: "Old article",
          content_sanitized: "<p>old</p>",
          summary: null,
          url: "https://example.com/old/1",
          author: null,
          published_at: "2025-11-01T00:00:00.000Z",
          thumbnail: null,
          is_read: true,
          is_starred: false,
        },
      ],
    },
    currentStatusValue: "Keep",
    editing: false,
    editor: null,
  },
};

export const EditingState: Story = {
  args: {
    ...CandidateReview.args,
    editing: true,
    editor: (
      <div className="rounded-md border border-border bg-card px-4 py-6 text-sm text-muted-foreground">
        Inline editor placeholder
      </div>
    ),
  },
};

export const IntegrityIssueReview: Story = {
  args: {
    ...baseLabels,
    integrityMode: true,
    selectedIntegrityIssue: {
      missing_feed_id: "feed-missing-42",
      article_count: 12,
      latest_article_title: "Broken reference article",
      latest_article_published_at: "2025-10-05T00:00:00.000Z",
    },
    selectedCandidate: null,
    selectedSummary: null,
    editing: false,
    editor: null,
  },
};
