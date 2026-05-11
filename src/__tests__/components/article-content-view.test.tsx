import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SanitizedArticleHtmlDtoSchema } from "@/api/schemas/article";
import {
  ArticleContentView,
  fromSanitizedArticleHtml,
  fromSanitizedArticleHtmlDto,
  type SanitizedArticleHtml,
} from "@/components/reader/article-content-view";
import articleContentViewStories from "@/components/reader/article-content-view.stories";

function dangerouslyBrandRawArticleHtmlForViewTest(rawHtml: string): SanitizedArticleHtml {
  return fromSanitizedArticleHtml(rawHtml);
}

describe("ArticleContentView", () => {
  it("renders a thumbnail and sanitized html content", () => {
    const { container } = render(
      <ArticleContentView
        thumbnailUrl="https://example.com/thumbnail.png"
        contentHtml={fromSanitizedArticleHtmlDto({
          content_sanitized: "<p>Hello <strong>world</strong> <a href='https://example.com'>link</a></p>",
        })}
      />,
    );

    const thumbnail = screen.getByAltText("");
    expect(thumbnail).toHaveAttribute("src", "https://example.com/thumbnail.png");
    expect(thumbnail).toHaveAttribute("referrerpolicy", "no-referrer");
    expect(thumbnail.parentElement).toHaveClass("mb-10");
    expect(thumbnail.parentElement).toHaveClass("rounded-lg", "bg-surface-1/70");
    expect(screen.getByText("Hello", { exact: false })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "link" })).toHaveAttribute("href", "https://example.com");
    expect(screen.getByRole("link", { name: "link" })).toHaveAttribute("rel", "noopener noreferrer");
    const prose = container.querySelector(".prose");
    expect(prose).not.toBeNull();
    expect(prose).toHaveClass("text-[1.02rem]");
    expect(prose).toHaveClass("leading-8");
    expect(prose).toHaveClass("text-foreground");
  });

  it("omits the thumbnail wrapper when no image is provided", () => {
    const { container } = render(
      <ArticleContentView contentHtml={dangerouslyBrandRawArticleHtmlForViewTest("<p>Only text</p>")} />,
    );

    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("Only text")).toBeInTheDocument();
  });

  it("omits article thumbnails that are outside the reader image policy", () => {
    const { container, rerender } = render(
      <ArticleContentView
        thumbnailUrl="http://example.com/thumbnail.png"
        contentHtml={dangerouslyBrandRawArticleHtmlForViewTest("<p>Only text</p>")}
      />,
    );

    expect(container.querySelector("img")).toBeNull();

    rerender(
      <ArticleContentView
        thumbnailUrl="data:image/svg+xml,<svg></svg>"
        contentHtml={dangerouslyBrandRawArticleHtmlForViewTest("<p>Only text</p>")}
      />,
    );

    expect(container.querySelector("img")).toBeNull();

    rerender(
      <ArticleContentView
        thumbnailUrl="https://user:pass@example.com/thumbnail.png"
        contentHtml={dangerouslyBrandRawArticleHtmlForViewTest("<p>Only text</p>")}
      />,
    );

    expect(container.querySelector("img")).toBeNull();

    rerender(
      <ArticleContentView
        thumbnailUrl="https://127.0.0.1/thumbnail.png"
        contentHtml={dangerouslyBrandRawArticleHtmlForViewTest("<p>Only text</p>")}
      />,
    );

    expect(container.querySelector("img")).toBeNull();
  });

  it("hides a duplicated feed-name label at the start of article content", () => {
    const { container } = render(
      <ArticleContentView
        feedName="葬送のフリーレン"
        contentHtml={fromSanitizedArticleHtmlDto({
          content_sanitized:
            "<p>葬送のフリーレン</p><p>本文です</p><figure><p><img src='https://example.com/panel.png' alt='' /></p></figure>",
        })}
      />,
    );

    expect(screen.getByText("本文です")).toBeInTheDocument();
    expect(screen.getByAltText("")).toHaveAttribute("src", "https://example.com/panel.png");
    expect(container.querySelector(".prose")?.textContent?.trim()).toBe("本文です");
  });

  it("keeps the opening content when it does not duplicate the feed name", () => {
    render(
      <ArticleContentView
        feedName="葬送のフリーレン"
        contentHtml={dangerouslyBrandRawArticleHtmlForViewTest("<p>第147話 英雄のいない地</p><p>本文です</p>")}
      />,
    );

    expect(screen.getByText("第147話 英雄のいない地")).toBeInTheDocument();
    expect(screen.getByText("本文です")).toBeInTheDocument();
  });

  it("hides placeholder null article bodies", () => {
    const { container, rerender } = render(
      <ArticleContentView contentHtml={dangerouslyBrandRawArticleHtmlForViewTest("null")} />,
    );

    expect(screen.queryByText("null")).not.toBeInTheDocument();
    expect(container.querySelector(".prose")?.textContent?.trim()).toBe("");

    rerender(<ArticleContentView contentHtml={dangerouslyBrandRawArticleHtmlForViewTest("<p>null</p>")} />);

    expect(screen.queryByText("null")).not.toBeInTheDocument();
    expect(container.querySelector(".prose")?.textContent?.trim()).toBe("");
  });

  it("uses a fixture-only thumbnail in storybook", () => {
    expect(articleContentViewStories.args?.thumbnailUrl).toBeTruthy();
    expect(articleContentViewStories.args?.thumbnailUrl).not.toMatch(/^https?:\/\//);
  });

  it("brands article content from the sanitized backend DTO boundary", () => {
    const sanitizedDto = {
      content_sanitized: "<p data-source='rust-sanitizer'>Safe <em>content</em></p>",
    };

    expect(fromSanitizedArticleHtmlDto(sanitizedDto)).toBe(sanitizedDto.content_sanitized);
  });

  it("keeps the sanitized HTML brand boundary tied to the runtime DTO schema", () => {
    const articleDto = SanitizedArticleHtmlDtoSchema.parse({
      content_sanitized: "<p data-source='rust-sanitizer'>Safe <em>content</em></p>",
    });

    expect(fromSanitizedArticleHtmlDto(articleDto)).toBe(articleDto.content_sanitized);
    expect(() => SanitizedArticleHtmlDtoSchema.parse({ content: "<p>Raw body</p>" })).toThrow();
    expect(() => SanitizedArticleHtmlDtoSchema.parse({ content_sanitized: null })).toThrow();
  });

  it("rejects raw string content at the view prop type boundary", () => {
    const unsafeProps: Parameters<typeof ArticleContentView>[0] = {
      // @ts-expect-error ArticleContentView only accepts SanitizedArticleHtml, not arbitrary strings.
      contentHtml: "<p>Raw unsanitized body</p>",
    };

    expect(unsafeProps.contentHtml).toBe("<p>Raw unsanitized body</p>");
  });

  it("keeps the legacy raw string brand helper isolated for explicit local tests", () => {
    const sanitizedHtml = "<p data-source='rust-sanitizer'>Safe <em>content</em></p>";

    expect(dangerouslyBrandRawArticleHtmlForViewTest(sanitizedHtml)).toBe(sanitizedHtml);
  });

  it("does not re-sanitize content at the React danger boundary", () => {
    const rustSanitizedHtml = dangerouslyBrandRawArticleHtmlForViewTest(
      "<p>Safe body</p><a href='https://example.com/article' rel='noopener noreferrer'>Read more</a>",
    );

    const { container } = render(<ArticleContentView contentHtml={rustSanitizedHtml} />);

    expect(screen.getByText("Safe body")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Read more" })).toHaveAttribute("href", "https://example.com/article");
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("[onclick]")).toBeNull();
  });

  it("keeps tables and code blocks inside the reader content layout", () => {
    const { container } = render(
      <ArticleContentView
        contentHtml={fromSanitizedArticleHtmlDto({
          content_sanitized:
            "<p>Metrics</p><table><thead><tr><th>Key</th><th>Value</th></tr></thead><tbody><tr><td>very_long_metric_name_without_breaks</td><td>1234567890</td></tr></tbody></table><pre><code>const veryLongIdentifierWithoutBreaks = 'abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz';</code></pre><p><code>inline_identifier_without_breaks</code></p>",
        })}
      />,
    );

    const prose = container.querySelector(".prose");
    expect(prose).not.toBeNull();
    expect(prose).toHaveClass("min-w-0");
    expect(prose).toHaveClass("overflow-x-hidden");
    expect(prose).toHaveClass("prose-table:block");
    expect(prose).toHaveClass("prose-table:max-w-full");
    expect(prose).toHaveClass("prose-table:overflow-x-auto");
    expect(prose).toHaveClass("prose-pre:max-w-full");
    expect(prose).toHaveClass("prose-pre:overflow-x-auto");
    expect(prose).toHaveClass("prose-code:break-words");
    expect(screen.getByText("very_long_metric_name_without_breaks")).toBeInTheDocument();
    expect(screen.getByText("const veryLongIdentifierWithoutBreaks", { exact: false })).toBeInTheDocument();
    expect(screen.getByText("inline_identifier_without_breaks")).toBeInTheDocument();
  });

  it("smoke-renders a large sanitized article body without expanding render wrappers", () => {
    const paragraphs = Array.from(
      { length: 500 },
      (_, index) => `<p>Large import paragraph ${index + 1} with sanitized reader content.</p>`,
    ).join("");

    const { container } = render(
      <ArticleContentView
        contentHtml={fromSanitizedArticleHtmlDto({
          content_sanitized: paragraphs,
        })}
      />,
    );

    expect(container.querySelectorAll(".prose")).toHaveLength(1);
    expect(screen.getByText("Large import paragraph 1 with sanitized reader content.")).toBeInTheDocument();
    expect(screen.getByText("Large import paragraph 500 with sanitized reader content.")).toBeInTheDocument();
  });

  it("keeps reader remote images separate from Web Preview frame behavior", () => {
    const { container } = render(
      <ArticleContentView
        thumbnailUrl="https://cdn.example.com/thumbnail.jpg"
        contentHtml={fromSanitizedArticleHtmlDto({
          content_sanitized: "<p>Article body</p><img src='https://cdn.example.com/body.jpg' alt='Body image' />",
        })}
      />,
    );

    expect(screen.getByAltText("")).toHaveAttribute("src", "https://cdn.example.com/thumbnail.jpg");
    expect(screen.getByRole("img", { name: "Body image" })).toHaveAttribute("src", "https://cdn.example.com/body.jpg");
    expect(screen.getByRole("img", { name: "Body image" })).toHaveAttribute("referrerpolicy", "no-referrer");
    expect(container.querySelector("iframe")).toBeNull();
    expect(container.querySelector("[data-browser-webview-iframe]")).toBeNull();
  });

  it("uses the reader content privacy policy for body links, images, and title tooltips", () => {
    const { container } = render(
      <ArticleContentView
        contentHtml={fromSanitizedArticleHtmlDto({
          content_sanitized:
            '<p><a href="https://user:pass@example.com/private" title="https://user:pass@example.com/private?token=raw">Credential link</a><a href="https://example.com/article" title="https://example.com/article?token=raw">Public link</a></p><img src="https://localhost/private.jpg" title="https://localhost/private.jpg?token=raw" alt="Private image"><img src="https://cdn.example.com/body.jpg" alt="Body image">',
        })}
      />,
    );

    const credentialAnchor = screen.getByText("Credential link").closest("a");
    expect(credentialAnchor).not.toBeNull();
    expect(credentialAnchor).not.toHaveAttribute("href");
    expect(credentialAnchor).toHaveAttribute("title", "External link");
    expect(screen.getByRole("link", { name: "Public link" })).toHaveAttribute("href", "https://example.com/article");
    expect(screen.getByRole("link", { name: "Public link" })).toHaveAttribute("title", "External link");
    expect(screen.getByRole("img", { name: "Private image" })).not.toHaveAttribute("src");
    expect(screen.getByRole("img", { name: "Private image" })).toHaveAttribute("title", "External image");
    expect(screen.getByRole("img", { name: "Body image" })).toHaveAttribute("src", "https://cdn.example.com/body.jpg");
    expect(container.innerHTML).not.toContain("user:pass");
    expect(container.innerHTML).not.toContain("localhost/private.jpg");
    expect(container.innerHTML).not.toContain("token=raw");
  });
});
