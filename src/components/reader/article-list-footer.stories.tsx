import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { ArticleListFooter } from "./article-list-footer";

const meta = {
  title: "Reader/Article/ArticleListFooter",
  component: ArticleListFooter,
  tags: ["autodocs"],
  args: {
    viewMode: "all",
    modes: ["unread", "all", "starred"],
    disabledModes: [],
    onSetViewMode: fn(),
  },
  decorators: [
    (Story) => (
      <div className="dark bg-[#09090b] p-4">
        <div className="w-[320px] overflow-hidden rounded-md border border-border bg-card shadow-elevation-1">
          <Story />
        </div>
      </div>
    ),
  ],
} satisfies Meta<typeof ArticleListFooter>;

export default meta;

type Story = StoryObj<typeof meta>;

export const AllSelected: Story = {};

export const UnreadSelected: Story = {
  args: {
    viewMode: "unread",
  },
};

export const StarredSelected: Story = {
  args: {
    viewMode: "starred",
  },
};
