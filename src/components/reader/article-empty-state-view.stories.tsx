import type { Meta, StoryObj } from "@storybook/react-vite";
import { ArticleEmptyStateView } from "./article-empty-state-view";

const meta = {
  title: "Reader/ArticleEmptyStateView",
  component: ArticleEmptyStateView,
  tags: ["autodocs"],
  args: {
    message: "Select an article to read",
  },
  decorators: [
    (Story) => (
      <div className="flex h-[320px] bg-background">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ArticleEmptyStateView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
Default.args = {
  hints: ["Choose an article from the list", "Use / to search", "Open Web Preview from the toolbar"],
};
