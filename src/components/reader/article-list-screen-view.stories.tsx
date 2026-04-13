import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { ArticleListScreenView } from "./article-list-screen-view";

const articleFixture = {
  id: "art-1",
  feed_id: "feed-1",
  title: "First Article",
  content_sanitized: "<p>Hello world</p>",
  summary: "A hello world article",
  url: "https://example.com/1",
  author: "Alice",
  published_at: "2026-03-25T10:00:00Z",
  thumbnail: null,
  is_read: false,
  is_starred: false,
};

const meta = {
  title: "Reader/ArticleListScreenView",
  component: ArticleListScreenView,
  tags: ["autodocs"],
  args: {
    listAriaLabel: "Article list",
    listRef: { current: null },
    isLoading: false,
    loadingMessage: "Loading articles",
    emptyMessage: "No articles",
    groups: [
      {
        id: "today",
        label: "Today",
        showLabel: true,
        items: [
          {
            article: articleFixture,
            feedName: "Tech Blog",
            isSelected: false,
            isRecentlyRead: false,
          },
        ],
      },
    ],
    dimArchived: "true",
    textPreview: "true",
    imagePreviews: "off",
    selectionStyle: "modern",
    onSelectArticle: fn(),
  },
  decorators: [
    (Story) => (
      <div className="h-[480px] w-full max-w-[380px] overflow-hidden border border-border bg-card">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ArticleListScreenView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Loading: Story = {
  args: {
    isLoading: true,
    groups: [],
  },
};

export const Empty: Story = {
  args: {
    groups: [],
  },
};
