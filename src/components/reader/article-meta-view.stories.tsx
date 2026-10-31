import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { ArticleMetaView } from "./article-meta-view";

const meta = {
  title: "Reader/Article/ArticleMetaView",
  component: ArticleMetaView,
  tags: ["autodocs"],
  args: {
    title: "First Article",
    author: "Alice",
    feedName: "Tech Blog",
    publishedLabel: "Mar 25, 2026",
    onTitleClick: fn(),
    onTitleAuxClick: fn(),
    onFeedClick: fn(),
  },
  decorators: [
    (Story) => (
      <div className="max-w-3xl bg-background p-8">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ArticleMetaView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Interactive: Story = {};

export const StaticTitle: Story = {
  args: {
    author: null,
    feedName: null,
    onTitleClick: undefined,
    onTitleAuxClick: undefined,
    onFeedClick: undefined,
  },
};

const breakUiFeedName = "Global technology and science reporting — 最新の科学技術と国際ニュースを詳しく伝えるフィード";

export const WorstCaseEmptyTitleNarrow: Story = {
  name: "Break UI / Empty title (320px)",
  decorators: [
    (Story) => (
      <div className="w-[320px] bg-background p-6" data-testid="article-meta-empty-title-narrow">
        <Story />
      </div>
    ),
  ],
  args: {
    title: "",
    author: null,
    feedName: null,
    publishedLabel: "FRIDAY, OCTOBER 30, 2026 AT 10:00 AM",
    onTitleClick: undefined,
    onTitleAuxClick: undefined,
    onFeedClick: undefined,
  },
};

export const WorstCaseEmptyTitleWide: Story = {
  name: "Break UI / Empty title (900px)",
  decorators: [
    (Story) => (
      <div className="max-w-[900px] bg-background p-8" data-testid="article-meta-empty-title-wide">
        <Story />
      </div>
    ),
  ],
  args: WorstCaseEmptyTitleNarrow.args,
};

export const WorstCaseOrphanSeparatorNarrow: Story = {
  name: "Break UI / Meta separator (320px)",
  decorators: [
    (Story) => (
      <div className="w-[320px] bg-background p-6" data-testid="article-meta-separator-narrow">
        <Story />
      </div>
    ),
  ],
  args: {
    title: "International science and technology research report with a long headline 📰",
    author: "Aleksandra Wiśniewska-Kowalczyk",
    feedName: breakUiFeedName,
    publishedLabel: "FRIDAY, OCTOBER 30, 2026 AT 10:00 AM",
    onTitleClick: undefined,
    onTitleAuxClick: undefined,
    onFeedClick: undefined,
  },
};

export const WorstCaseOrphanSeparatorWide: Story = {
  name: "Break UI / Meta separator (900px)",
  decorators: [
    (Story) => (
      <div className="max-w-[900px] bg-background p-8" data-testid="article-meta-separator-wide">
        <Story />
      </div>
    ),
  ],
  args: WorstCaseOrphanSeparatorNarrow.args,
};
