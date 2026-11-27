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
    onShowFeed: fn(),
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

const siteLink = {
  href: "https://example.com/",
  label: "example.com",
  title: "Open in app (example.com)",
  onOpen: fn(),
};

export const Interactive: Story = {
  args: { siteLink },
};

export const WithoutSiteLink: Story = {};

export const StaticTitle: Story = {
  args: {
    author: null,
    feedName: null,
    onTitleClick: undefined,
    onTitleAuxClick: undefined,
    onShowFeed: undefined,
  },
};

const breakUiFeedName = "Global technology and science reporting — 最新の科学技術と国際ニュースを詳しく伝えるフィード";

export const WorstCaseMetaLayout: Story = {
  name: "Break UI / Meta layout (320px)",
  decorators: [
    (Story) => (
      <div className="w-[320px] bg-background p-6" data-testid="article-meta-break-ui-worst-case">
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
    onShowFeed: undefined,
  },
};
