import { act, fireEvent, render, screen } from "@testing-library/react";
import { parse } from "valibot";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SanitizedArticleHtmlDtoSchema } from "@/api/schemas/article";
import { ArticleContentView } from "@/components/reader/article-content-view";
import articleContentViewStories from "@/components/reader/article-content-view.stories";
import { fromSanitizedArticleHtml, fromSanitizedArticleHtmlDto, type SanitizedArticleHtml } from "@/lib/content/html";

function dangerouslyBrandRawArticleHtmlForViewTest(rawHtml: string): SanitizedArticleHtml {
  return fromSanitizedArticleHtml(rawHtml);
}

describe("ArticleContentView", () => {
  afterEach(() => vi.restoreAllMocks());

  it("gives overflowing tables and code keyboard access and updates it as their size changes", () => {
    let scrollWidth = 400;
    let measure = () => {};
    vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockImplementation(() => scrollWidth);
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(200);
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback: () => void) {
          measure = callback;
        }
        observe() {}
        disconnect() {}
      },
    );

    const { container, rerender } = render(
      <ArticleContentView
        contentHtml={fromSanitizedArticleHtml(
          "<table><tbody><tr><td>Metrics</td></tr></tbody></table><pre>Code</pre><pre tabindex='-1'>Authored focus policy</pre>",
        )}
      />,
    );
    const table = screen.getByRole("table");
    const code = screen.getByText("Code");
    expect(table).toHaveAttribute("tabindex", "0");
    expect(code).toHaveAttribute("tabindex", "0");
    expect(screen.getByText("Authored focus policy")).toHaveAttribute("tabindex", "-1");
    table.focus();
    expect(table).toHaveFocus();

    scrollWidth = 100;
    act(() => measure());
    expect(table).not.toHaveAttribute("tabindex");
    expect(code).not.toHaveAttribute("tabindex");
    expect(screen.getByText("Authored focus policy")).toHaveAttribute("tabindex", "-1");

    scrollWidth = 400;
    rerender(<ArticleContentView contentHtml={fromSanitizedArticleHtml("<pre>Replacement code</pre>")} />);
    expect(screen.getByText("Replacement code")).toHaveAttribute("tabindex", "0");
    expect(container.querySelector(".prose")).toHaveClass(
      "prose-pre:focus-visible:outline-2",
      "prose-table:focus-visible:outline-2",
    );
  });

  it("keeps overflow keyboard access available when ResizeObserver is unavailable", () => {
    vi.stubGlobal("ResizeObserver", undefined);
    vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockReturnValue(400);
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(200);
    render(<ArticleContentView contentHtml={fromSanitizedArticleHtml("<pre>Code</pre>")} />);
    expect(screen.getByText("Code")).toHaveAttribute("tabindex", "0");
  });

  it("updates overflow keyboard access when an article image loads", () => {
    let imageLoaded = false;
    let observerDisconnected = false;
    const observedElements = new Set<Element>();
    vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockImplementation(function (this: HTMLElement) {
      return this.matches("table") && imageLoaded ? 400 : 100;
    });
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(function (this: HTMLElement) {
      return this.matches("table") ? 200 : 100;
    });
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe(target: Element) {
          observedElements.add(target);
        }
        disconnect() {
          observerDisconnected = true;
        }
      },
    );

    const { unmount } = render(
      <ArticleContentView
        contentHtml={fromSanitizedArticleHtml(
          "<table><tbody><tr><td><img src='https://example.com/chart.png' alt='Chart' /></td></tr></tbody></table>",
        )}
      />,
    );
    const table = screen.getByRole("table");
    const tableChild = table.firstElementChild;
    const image = screen.getByRole("img", { name: "Chart" });
    if (!tableChild) throw new Error("Expected the overflowing table to have an element child");
    expect(table).not.toHaveAttribute("data-reader-horizontal-scroll-region");
    expect(table).not.toHaveAttribute("tabindex");
    imageLoaded = true;
    fireEvent.load(image);

    expect(table).toHaveAttribute("data-reader-horizontal-scroll-region", "true");
    expect(table).toHaveAttribute("tabindex", "0");
    expect(observedElements.has(table)).toBe(true);
    expect(observedElements.has(tableChild)).toBe(true);

    unmount();
    expect(observerDisconnected).toBe(true);
    fireEvent.load(image);
    expect(table).not.toHaveAttribute("data-reader-horizontal-scroll-region");
    expect(table).not.toHaveAttribute("tabindex");
  });

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

  it("renders http article thumbnails to match the sanitizer contract (docs/feed-content-privacy.md)", () => {
    const { container } = render(
      <ArticleContentView
        thumbnailUrl="http://example.com/thumbnail.png"
        contentHtml={dangerouslyBrandRawArticleHtmlForViewTest("<p>Only text</p>")}
      />,
    );

    const thumbnail = container.querySelector("img");
    expect(thumbnail).not.toBeNull();
    expect(thumbnail).toHaveAttribute("src", "http://example.com/thumbnail.png");
  });

  it("omits article thumbnails that are outside the reader image policy", () => {
    const { container, rerender } = render(
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
        thumbnailUrl="http://user:pass@example.com/thumbnail.png"
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

    rerender(
      <ArticleContentView
        thumbnailUrl="http://127.0.0.1/thumbnail.png"
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
    const articleDto = parse(SanitizedArticleHtmlDtoSchema, {
      content_sanitized: "<p data-source='rust-sanitizer'>Safe <em>content</em></p>",
    });

    expect(fromSanitizedArticleHtmlDto(articleDto)).toBe(articleDto.content_sanitized);
    expect(() => parse(SanitizedArticleHtmlDtoSchema, { content: "<p>Raw body</p>" })).toThrow();
    expect(() => parse(SanitizedArticleHtmlDtoSchema, { content_sanitized: null })).toThrow();
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
    expect(screen.getByText("very_long_metric_name_without_breaks")).toBeInTheDocument();
    expect(screen.getByText("const veryLongIdentifierWithoutBreaks", { exact: false })).toBeInTheDocument();
    expect(screen.getByText("inline_identifier_without_breaks")).toBeInTheDocument();
  });

  it("renders inline images from sanitized HTML", () => {
    render(
      <ArticleContentView
        contentHtml={fromSanitizedArticleHtmlDto({
          content_sanitized:
            "<p>Readable paragraph</p><p><img src='https://cdn.example.com/panel.jpg' alt='Panel'></p><figure><img src='https://cdn.example.com/figure.jpg' alt='Figure'></figure>",
        })}
      />,
    );

    expect(screen.getByRole("img", { name: "Panel" })).toHaveAttribute("src", "https://cdn.example.com/panel.jpg");
    expect(screen.getByRole("img", { name: "Figure" })).toHaveAttribute("src", "https://cdn.example.com/figure.jpg");
  });

  it("keeps feed-supplied dir attributes on mixed-script paragraphs", () => {
    const { container } = render(
      <ArticleContentView
        contentHtml={fromSanitizedArticleHtmlDto({
          content_sanitized:
            '<p>أخبار العلوم 2026 and English punctuation.</p><p dir="rtl">English paragraph with explicit direction.</p><blockquote>اقتباس — quote.</blockquote>',
        })}
      />,
    );

    expect(screen.getByText("أخبار العلوم 2026 and English punctuation.")).toBeInTheDocument();
    const explicitDirParagraph = container.querySelector('p[dir="rtl"]');
    expect(explicitDirParagraph).toHaveTextContent("English paragraph with explicit direction.");
    expect(explicitDirParagraph).toHaveAttribute("dir", "rtl");
  });

  it("smoke-renders a large sanitized article body with many remote images without expanding render wrappers", () => {
    const paragraphs = Array.from(
      { length: 500 },
      (_, index) =>
        `<p>Large import paragraph ${index + 1} with sanitized reader content.</p>${
          index % 10 === 0 ? `<img src="https://cdn.example.com/body-${index}.jpg" alt="Body image ${index}" />` : ""
        }`,
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
    expect(screen.getByRole("img", { name: "Body image 0" })).toHaveAttribute(
      "src",
      "https://cdn.example.com/body-0.jpg",
    );
    expect(screen.getAllByRole("img", { name: /^Body image/ })).toHaveLength(50);
  });

  it("keeps the pre-virtualization selection and find contract on one native content surface", () => {
    const { container } = render(
      <ArticleContentView
        contentHtml={fromSanitizedArticleHtmlDto({
          content_sanitized:
            "<h2>Intro</h2><p>First selectable paragraph.</p><p>Second paragraph with search term.</p>",
        })}
      />,
    );

    const prose = container.querySelector(".prose");
    expect(prose).not.toBeNull();
    expect(prose).toHaveAttribute("data-reader-content-contract", "native-contiguous-dom");
    expect(prose).toHaveAttribute("data-reader-selection-contract", "native-dom-selection");
    expect(prose).toHaveAttribute("data-reader-search-highlight-contract", "browser-find-no-inline-marks");
    expect(prose).toHaveAttribute("data-reader-scroll-anchor", "article-content");
    expect(prose).toHaveAttribute("data-reader-image-loading-contract", "lazy-native");
    expect(prose?.textContent).toBe("IntroFirst selectable paragraph.Second paragraph with search term.");
    expect(container.querySelectorAll(".prose")).toHaveLength(1);
    expect(container.querySelector("mark")).toBeNull();
    expect(container.querySelector("[data-reader-search-highlight]")).toBeNull();
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
