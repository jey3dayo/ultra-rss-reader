import type { Meta, StoryObj } from "@storybook/react-vite";
import { ArticleContentView } from "./article-content-view";

const meta = {
  title: "Reader/Article/ArticleContentView",
  component: ArticleContentView,
  tags: ["autodocs"],
  args: {
    thumbnailUrl:
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1200 675'%3E%3Crect width='1200' height='675' fill='%23111827'/%3E%3Crect x='72' y='72' width='1056' height='531' rx='24' fill='%231f2937' stroke='%23374151' stroke-width='8'/%3E%3Ccircle cx='240' cy='220' r='72' fill='%23f59e0b' opacity='0.9'/%3E%3Cpath d='M160 500L360 320L500 440L660 260L900 500Z' fill='%2334d399' opacity='0.9'/%3E%3Ctext x='96' y='592' fill='%23f9fafb' font-family='sans-serif' font-size='56' font-weight='700'%3EStorybook Fixture Thumbnail%3C/text%3E%3C/svg%3E",
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
