import type { Meta, StoryObj } from "@storybook/react-vite";
import type { CSSProperties, ReactNode } from "react";
import { fn } from "storybook/test";
import { denseNarrowViewportParameters } from "@/components/storybook/viewport-fixtures";
import { ArticleListScreenView } from "./article-list-screen-view";

type CssVariableProperties = CSSProperties & Record<`--${string}`, string | number>;

const darkStoryFrameStyle: CssVariableProperties = {
  colorScheme: "dark",
  "--background": "#1c1915",
  "--foreground": "#f3efe6",
  "--card": "#26221d",
  "--border": "rgba(243, 239, 230, 0.12)",
  "--border-strong": "rgba(243, 239, 230, 0.22)",
  "--surface-1": "#221e19",
  "--surface-2": "#27231d",
  "--surface-3": "#2d2822",
  "--surface-4": "#363028",
  "--color-border": "rgba(243, 239, 230, 0.12)",
  "--color-border-strong": "rgba(243, 239, 230, 0.22)",
};

function StoryFrame({ children, theme = "light" }: { children: ReactNode; theme?: "light" | "dark" }) {
  return (
    <div className={theme === "dark" ? "dark" : undefined} style={theme === "dark" ? darkStoryFrameStyle : undefined}>
      <div className="h-[480px] w-full max-w-[380px] overflow-hidden border border-border bg-card text-foreground">
        {children}
      </div>
    </div>
  );
}

function withTheme(theme: "light" | "dark") {
  return (Story: () => ReactNode) => (
    <StoryFrame theme={theme}>
      <Story />
    </StoryFrame>
  );
}

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

const selectedShortJapaneseArticleFixture = {
  id: "art-selected-short-japanese",
  feed_id: "feed-1",
  title: "第57話",
  content_sanitized: "<p>三郷さんは甘すぎ上司にちょっとキビしい</p>",
  summary: "三郷さんは甘すぎ上司にちょっとキビしい",
  url: "https://example.com/episode-57",
  author: null,
  published_at: "2026-05-15T07:30:00Z",
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
  decorators: [withTheme("light")],
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

export const SelectedJapaneseUnreadWithoutScrollbar: Story = {
  args: {
    listAriaLabel: "記事一覧",
    groups: [
      {
        id: "may-15",
        label: "2026年5月15日",
        showLabel: true,
        items: [
          {
            article: selectedShortJapaneseArticleFixture,
            feedName: "コミック",
            isSelected: true,
            isRecentlyRead: false,
          },
        ],
      },
    ],
  },
};

export const SelectedJapaneseUnreadWithScrollbarLight: Story = {
  args: SelectedJapaneseUnreadWithScrollbar.args,
  name: "Selected Japanese Unread With Scrollbar / Light",
  decorators: [withTheme("light")],
};

export const SelectedJapaneseUnreadWithScrollbarDark: Story = {
  args: SelectedJapaneseUnreadWithScrollbar.args,
  name: "Selected Japanese Unread With Scrollbar / Dark",
  decorators: [withTheme("dark")],
};

export const DenseNarrowViewport: Story = {
  parameters: denseNarrowViewportParameters,
  args: {
    listAriaLabel: "記事一覧",
    groups: [
      {
        id: "dense-today",
        label: "今日",
        showLabel: true,
        items: [
          {
            article: selectedJapaneseArticleFixture,
            feedName: "AUTOMATON",
            isSelected: true,
            isRecentlyRead: false,
          },
          ...scrollbarFillerArticles.slice(0, 5).map((article) => ({
            article,
            feedName: "テックニュースまとめ",
            isSelected: false,
            isRecentlyRead: false,
          })),
        ],
      },
    ],
  },
};
