import type { Meta, StoryObj } from "@storybook/react-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fn } from "storybook/test";
import { ArticleGroupsView } from "./article-groups-view";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
  },
});

const articleFixtures = [
  {
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
  },
  {
    id: "art-2",
    feed_id: "feed-1",
    title: "Second Article",
    content_sanitized: "<p>Another post</p>",
    summary: null,
    url: "https://example.com/2",
    author: null,
    published_at: "2026-03-24T08:00:00Z",
    thumbnail: null,
    is_read: true,
    is_starred: true,
  },
];

const meta = {
  title: "Reader/ArticleGroupsView",
  component: ArticleGroupsView,
  tags: ["autodocs"],
  args: {
    groups: [
      {
        id: "today",
        label: "Today",
        showLabel: true,
        items: [
          {
            article: articleFixtures[0],
            feedName: "Tech Blog",
            isSelected: false,
            isRecentlyRead: false,
          },
        ],
      },
      {
        id: "yesterday",
        label: "Yesterday",
        showLabel: true,
        items: [
          {
            article: articleFixtures[1],
            feedName: "Tech Blog",
            isSelected: true,
            isRecentlyRead: true,
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
      <QueryClientProvider client={queryClient}>
        <div className="w-[380px] bg-card">
          <Story />
        </div>
      </QueryClientProvider>
    ),
  ],
} satisfies Meta<typeof ArticleGroupsView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const GroupedByDate: Story = {};

export const Ungrouped: Story = {
  args: {
    groups: [
      {
        id: "all",
        label: "Unused",
        showLabel: false,
        items: [
          {
            article: articleFixtures[0],
            feedName: undefined,
            isSelected: false,
            isRecentlyRead: false,
          },
          {
            article: articleFixtures[1],
            feedName: undefined,
            isSelected: true,
            isRecentlyRead: true,
          },
        ],
      },
    ],
    selectionStyle: "classic",
  },
};
