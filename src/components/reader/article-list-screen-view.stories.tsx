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

const selectedJapaneseArticleFixture = {
  id: "art-selected-japanese",
  feed_id: "feed-1",
  title: "爆裂インフレ麻雀ローグライク『Hell Wait』発表。ジョーカー牌で点数爆盛り、敗北すれば“指…”",
  content_sanitized: "<p>個人ゲーム開発者のMondbekker氏は5月6日、『Hell Wait』を発表した。</p>",
  summary: "個人ゲーム開発者のMondbekker氏は5月6日、『Hell Wait』を発表した。",
  url: "https://example.com/hell-wait",
  author: null,
  published_at: "2026-05-06T07:30:00Z",
  thumbnail: null,
  is_read: false,
  is_starred: false,
};

const scrollbarFillerArticles = Array.from({ length: 7 }, (_, index) => ({
  id: `art-scrollbar-${index + 1}`,
  feed_id: "feed-1",
  title: `スクロール確認用の記事 ${index + 1}`,
  content_sanitized: "<p>Scrollbar filler article.</p>",
  summary: "スクロールバーが出る高さを確保するための確認用テキストです。",
  url: `https://example.com/scrollbar-${index + 1}`,
  author: null,
  published_at: `2026-05-0${Math.min(index + 1, 9)}T08:00:00Z`,
  thumbnail: null,
  is_read: index % 2 === 0,
  is_starred: false,
}));

const meta = {
  title: "Reader/Article/ArticleListScreenView",
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

export const SetupEmpty: Story = {
  args: {
    groups: [],
    emptyStateVariant: "setup",
    emptyMessage: "Add an account and your articles will appear here.",
    emptyDescription: "The list stays empty until the initial setup is complete.",
  },
};

export const SelectedJapaneseUnreadWithScrollbar: Story = {
  args: {
    groups: [
      {
        id: "today",
        label: "今日",
        showLabel: true,
        items: [
          {
            article: selectedJapaneseArticleFixture,
            feedName: "AUTOMATON",
            isSelected: true,
            isRecentlyRead: false,
          },
          ...scrollbarFillerArticles.map((article) => ({
            article,
            feedName: "AUTOMATON",
            isSelected: false,
            isRecentlyRead: false,
          })),
        ],
      },
    ],
  },
};
