import type { Meta, StoryObj } from "@storybook/react-vite";
import { fromSanitizedArticleHtml } from "@/lib/content/html";
import { ArticleContentView } from "./article-content-view";

const worstCaseArticleTypographyHtml = `<h1>International research briefing 📰</h1>
<h2>Nested lists and headings</h2>
<p>Intro paragraph with <strong>emphasis</strong>, a <a href="https://example.com/article">public link</a>, and inline <code>token_value</code>.</p>
<ul>
  <li>Top level with English
    <ul>
      <li>Nested item ألف باء</li>
      <li>Nested item with numbers 12,345</li>
    </ul>
  </li>
  <li>Second branch
    <ol>
      <li>Ordered nested one</li>
      <li>Ordered nested two</li>
    </ol>
  </li>
</ul>
<h3>Wide table</h3>
<table>
  <thead>
    <tr><th>Metric</th><th>Very long column value without breaks</th><th>Notes</th></tr>
  </thead>
  <tbody>
    <tr><td>Latency</td><td>very_long_table_cell_value_without_breaks_abcdefghijklmnopqrstuvwxyz_abcdefghijklmnopqrstuvwxyz</td><td>ms</td></tr>
    <tr><td>Throughput</td><td>another_extremely_long_table_cell_for_horizontal_scroll_verification_1234567890</td><td>rps</td></tr>
  </tbody>
</table>
<h3>Long preformatted line</h3>
<pre><code>const veryLongIdentifierWithoutBreaks = 'abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz';</code></pre>
<p>longunbrokenwordwithoutanybreaks_abcdefghijklmnopqrstuvwxyz_abcdefghijklmnopqrstuvwxyz</p>
<p dir="ltr">English paragraph with explicit left-to-right direction.</p>
<p>أخبار العلوم 2026 — mixed English punctuation: 1,234.56?</p>
<p dir="rtl">דיווח מעורב: 12,345 נקודות.</p>
<blockquote>اقتباس طويل مع English tail — em dash test.</blockquote>
<p><img src="https://placehold.co/640x360/d7dacd/2f3429.png?text=Inline+reader+media" alt="Inline reader media"></p>`;

const meta = {
  title: "Reader/Article/ArticleContentView",
  component: ArticleContentView,
  tags: ["autodocs"],
  args: {
    thumbnailUrl:
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1200 675'%3E%3Crect width='1200' height='675' fill='%23111827'/%3E%3Crect x='72' y='72' width='1056' height='531' rx='24' fill='%231f2937' stroke='%23374151' stroke-width='8'/%3E%3Ccircle cx='240' cy='220' r='72' fill='%23f59e0b' opacity='0.9'/%3E%3Cpath d='M160 500L360 320L500 440L660 260L900 500Z' fill='%2334d399' opacity='0.9'/%3E%3Ctext x='96' y='592' fill='%23f9fafb' font-family='sans-serif' font-size='56' font-weight='700'%3EStorybook Fixture Thumbnail%3C/text%3E%3C/svg%3E",
    contentHtml: fromSanitizedArticleHtml(
      "<p>Hello <strong>world</strong>.</p><p>This view renders only the thumbnail and sanitized article HTML.</p>",
    ),
  },
  decorators: [
    (Story) => (
      <article className="mx-auto max-w-3xl bg-background p-8">
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

export const OverflowContent: Story = {
  args: {
    thumbnailUrl: null,
    contentHtml: fromSanitizedArticleHtml(
      "<p>Layout stress fixture.</p><table><thead><tr><th>Column</th><th>Long value</th></tr></thead><tbody><tr><td>Reader contract</td><td>very_long_table_cell_value_without_breaks_abcdefghijklmnopqrstuvwxyz_abcdefghijklmnopqrstuvwxyz</td></tr></tbody></table><pre><code>const veryLongIdentifierWithoutBreaks = 'abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz';</code></pre><p><code>inline_identifier_without_breaks_abcdefghijklmnopqrstuvwxyz</code></p>",
    ),
  },
};

export const InlineImageMediaRail: Story = {
  args: {
    thumbnailUrl: null,
    contentHtml: fromSanitizedArticleHtml(
      '<p>Text paragraphs keep a comfortable reading measure even when the reader pane is wide.</p><p><img src="https://placehold.co/1200x675/d7dacd/2f3429.png?text=Inline+reader+media" alt="Inline reader media"></p><p>The next paragraph returns to the text rail instead of inheriting the image width.</p>',
    ),
  },
  decorators: [
    (Story) => (
      <article className="w-[min(100vw,1200px)] bg-background p-8">
        <Story />
      </article>
    ),
  ],
};

export const WorstCaseArticleTypography: Story = {
  name: "Break UI / Worst-case typography (720px)",
  args: {
    thumbnailUrl: null,
    contentHtml: fromSanitizedArticleHtml(worstCaseArticleTypographyHtml),
  },
  decorators: [
    (Story) => (
      <article
        className="mx-auto w-[720px] bg-background p-8 text-foreground"
        data-testid="article-content-worst-case-typography"
      >
        <Story />
      </article>
    ),
  ],
};
