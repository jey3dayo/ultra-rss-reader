import type { Meta, StoryObj } from "@storybook/react-vite";
import { ArticleContentView } from "./article-content-view";

const meta = {
  title: "Reader/ArticleContentView",
  component: ArticleContentView,
  tags: ["autodocs"],
  args: {
    thumbnailUrl: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=1200&h=675&fit=crop",
    contentHtml:
      "<p>Hello <strong>world</strong>.</p><p>This view renders only the thumbnail and sanitized article HTML.</p>",
  },
  decorators: [
    (Story) => (
      <article className="mx-auto max-w-3xl bg-background px-8 py-8">
        <Story />
      </article>
    ),
  ],
} satisfies Meta<typeof ArticleContentView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithThumbnail: Story = {};

export const TextOnly: Story = {
  args: {
    thumbnailUrl: null,
  },
};
