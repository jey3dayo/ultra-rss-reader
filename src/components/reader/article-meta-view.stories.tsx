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
      <div className="max-w-3xl bg-background px-8 py-8">
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
