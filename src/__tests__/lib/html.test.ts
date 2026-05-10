import { describe, expect, it } from "vitest";
import {
  applyReaderContentPrivacyPolicy,
  fromSanitizedArticleHtmlDto,
  normalizeArticleBodyHtml,
  stripHtmlTags,
} from "@/lib/content/html";

describe("fromSanitizedArticleHtmlDto", () => {
  it("brands the backend content_sanitized DTO field without accepting raw article body by default", () => {
    const article = {
      content_sanitized: "<p>Backend sanitized body</p>",
    };

    expect(fromSanitizedArticleHtmlDto(article)).toBe(article.content_sanitized);
  });
});

describe("stripHtmlTags", () => {
  it("returns empty string for empty input", () => {
    expect(stripHtmlTags("")).toBe("");
  });

  it("returns plain text unchanged", () => {
    expect(stripHtmlTags("Hello world")).toBe("Hello world");
  });

  it("strips simple HTML tags", () => {
    expect(stripHtmlTags("<p>Hello</p>")).toBe("Hello");
  });

  it("strips nested HTML tags", () => {
    expect(stripHtmlTags("<div><span>Hello</span> <b>world</b></div>")).toBe("Hello world");
  });

  it("strips img tags with attributes", () => {
    const html = '<div><img width="800" height="534" src="https://example.com/image.jpg">Some text</div>';
    expect(stripHtmlTags(html)).toBe("Some text");
  });

  it("strips self-closing tags", () => {
    expect(stripHtmlTags("Hello<br/>world")).toBe("Hello world");
  });

  it("decodes HTML entities", () => {
    expect(stripHtmlTags("&amp; &lt; &gt; &quot; &#39;")).toBe("& < > \" '");
  });

  it("decodes &nbsp; to space", () => {
    expect(stripHtmlTags("Hello&nbsp;world")).toBe("Hello world");
  });

  it("collapses multiple whitespace into single space", () => {
    expect(stripHtmlTags("<p>Hello</p>   <p>world</p>")).toBe("Hello world");
  });

  it("preserves spacing between adjacent block elements", () => {
    expect(stripHtmlTags("<p>Lead</p><p>Body</p>")).toBe("Lead Body");
    expect(stripHtmlTags("<ul><li>One</li><li>Two</li></ul>")).toBe("One Two");
  });

  it("handles complex real-world RSS content", () => {
    const html =
      '<div><img width="800" height="534" src="https://example.com/photo.jpg"><p>This is the article summary with <a href="https://example.com">a link</a>.</p></div>';
    const result = stripHtmlTags(html);
    expect(result).toBe("This is the article summary with a link.");
  });

  it("trims leading and trailing whitespace", () => {
    expect(stripHtmlTags("  <p> Hello </p>  ")).toBe("Hello");
  });

  it("extracts text from malformed html without preserving script or style bodies", () => {
    expect(stripHtmlTags("<p>Hello <strong>world</p><script>alert(1)</script><style>.x{}</style>")).toBe("Hello world");
  });

  it("keeps fallback extraction aligned for entities, partial scripts, and CJK spacing", () => {
    const originalDomParser = globalThis.DOMParser;
    // @ts-expect-error legacy escape: DOMParser global is intentionally unavailable in this fallback test.
    globalThis.DOMParser = undefined;

    try {
      expect(stripHtmlTags("<p>価格&#58; 100&nbsp;円</p><script>alert(1)")).toBe("価格: 100 円");
      expect(stripHtmlTags("<p>吾輩は</p><p>猫である</p>")).toBe("吾輩は 猫である");
      expect(stripHtmlTags("<style>.hidden{display:none}")).toBe("");
      expect(stripHtmlTags("<![CDATA[本文 &amp; 補足]]><p>続き</p>")).toBe("本文 & 補足 続き");
      expect(stripHtmlTags("<!-- tracking marker --><p>Visible</p>")).toBe("Visible");
    } finally {
      globalThis.DOMParser = originalDomParser;
    }
  });

  it("keeps regex fallback safe for malformed entities and large malformed HTML", () => {
    const originalDomParser = globalThis.DOMParser;
    // @ts-expect-error legacy escape: DOMParser global is intentionally unavailable in this fallback test.
    globalThis.DOMParser = undefined;

    try {
      expect(stripHtmlTags("<p>Bad decimal: &#999999999999;</p>")).toBe("Bad decimal: &#999999999999;");
      expect(stripHtmlTags("<p>Bad hex: &#x110000;</p>")).toBe("Bad hex: &#x110000;");
      expect(stripHtmlTags("<p>Broken named: &not-an-entity;</p>")).toBe("Broken named: &not-an-entity;");

      const hugeText = `${"<div>本文 &amp; 補足</div>".repeat(5_000)}<!-- unterminated`;
      const startedAt = performance.now();
      const result = stripHtmlTags(`${hugeText}<script>${"alert(1);".repeat(2_000)}`);
      const elapsedMs = performance.now() - startedAt;

      expect(result).not.toContain("alert(1)");
      expect(result.startsWith("本文 & 補足 本文 & 補足")).toBe(true);
      expect(elapsedMs).toBeLessThan(1_000);
    } finally {
      globalThis.DOMParser = originalDomParser;
    }
  });
});

describe("applyReaderContentPrivacyPolicy", () => {
  it("adds the reader body privacy policy to rendered media and links", () => {
    expect(
      applyReaderContentPrivacyPolicy(
        '<p><a href="https://example.com/article" rel="opener">Read</a><picture><source srcset="https://cdn.example.com/hero.webp 1x"><img src="https://cdn.example.com/hero.jpg" alt="Hero"></picture></p>',
      ),
    ).toContain('rel="noopener noreferrer"');
    expect(applyReaderContentPrivacyPolicy('<img src="https://cdn.example.com/hero.jpg" alt="Hero">')).toContain(
      'referrerpolicy="no-referrer"',
    );
  });

  it("keeps sanitized HTML unchanged when DOMParser is unavailable", () => {
    const originalDomParser = globalThis.DOMParser;
    // @ts-expect-error legacy escape: DOMParser global is intentionally unavailable in this fallback test.
    globalThis.DOMParser = undefined;

    try {
      const html = '<img src="https://cdn.example.com/hero.jpg" alt="Hero">';

      expect(applyReaderContentPrivacyPolicy(html)).toBe(html);
    } finally {
      globalThis.DOMParser = originalDomParser;
    }
  });

  it("keeps the frontend post-process aligned with the sanitizer link and media privacy corpus", () => {
    const corpus = [
      {
        label: "sanitized tracking link",
        html: '<a href="https://publisher.example.com/read?utm_source=feed">Read article</a>',
        required: ['href="https://publisher.example.com/read?utm_source=feed"', 'rel="noopener noreferrer"'],
      },
      {
        label: "sanitized article image",
        html: '<picture><source srcset="https://cdn.example.com/hero.webp 1x"><img src="https://cdn.example.com/hero.jpg" alt="Hero"></picture>',
        required: ['src="https://cdn.example.com/hero.jpg"', 'referrerpolicy="no-referrer"'],
      },
    ];

    for (const fixture of corpus) {
      const normalized = applyReaderContentPrivacyPolicy(fixture.html);

      for (const fragment of fixture.required) {
        expect(normalized, fixture.label).toContain(fragment);
      }
    }
  });
});

describe("normalizeArticleBodyHtml", () => {
  it("removes a duplicated leading article label", () => {
    expect(normalizeArticleBodyHtml("<h1>Article title</h1><p>Body text</p>", "Article title")).toBe(
      "<p>Body text</p>",
    );
  });

  it("keeps leading media nodes even when their text matches the label", () => {
    const html = '<figure><img src="https://example.com/image.png" alt="">Article title</figure><p>Body text</p>';

    expect(normalizeArticleBodyHtml(html, "Article title")).toBe(html);
  });

  it("removes a duplicated leading feed label with a separator suffix", () => {
    expect(normalizeArticleBodyHtml("<p>Tech Blog:</p><p>Body text</p>", "Tech Blog")).toBe("<p>Body text</p>");
    expect(normalizeArticleBodyHtml("<p>Tech Blog｜</p><p>Body text</p>", "Tech Blog")).toBe("<p>Body text</p>");
    expect(normalizeArticleBodyHtml("<p>Tech Blog -</p><p>Body text</p>", "Tech Blog")).toBe("<p>Body text</p>");
  });

  it("keeps leading nodes that only start with the feed label text", () => {
    const html = "<p>Tech Blog Weekly</p><p>Body text</p>";

    expect(normalizeArticleBodyHtml(html, "Tech Blog")).toBe(html);
  });

  it("keeps a same-title first body paragraph after a duplicated wrapper label", () => {
    expect(normalizeArticleBodyHtml("<h1>Article title</h1><p>Article title</p>", "Article title")).toBe(
      "<p>Article title</p>",
    );
  });

  it("keeps a label-only body instead of deleting all article content", () => {
    const html = "<p>Tech Blog</p>";

    expect(normalizeArticleBodyHtml(html, "Tech Blog")).toBe(html);
  });

  it("keeps duplicated leading labels when DOMParser is unavailable", () => {
    const originalDomParser = globalThis.DOMParser;
    // @ts-expect-error - test-only fallback path coverage.
    globalThis.DOMParser = undefined;

    try {
      const html = "<p>Tech Blog</p><p>Body text</p>";

      expect(normalizeArticleBodyHtml(html, "Tech Blog")).toBe(html);
    } finally {
      globalThis.DOMParser = originalDomParser;
    }
  });

  it("keeps leading media nodes even when their text matches a feed label suffix", () => {
    const html = '<figure><img src="https://example.com/image.png" alt="">Tech Blog:</figure><p>Body text</p>';

    expect(normalizeArticleBodyHtml(html, "Tech Blog")).toBe(html);
  });

  it("keeps media and link-only articles when the visible text matches the feed label", () => {
    const linkOnly = '<p><a href="https://example.com/article">Tech Blog</a></p>';
    const imageOnly = '<p><img src="https://example.com/image.png" alt=""></p>';
    const pictureOnly =
      '<picture><source srcset="https://example.com/image.webp" type="image/webp"><img src="https://example.com/image.png" alt=""></picture>';
    const videoOnly = '<video src="https://example.com/video.mp4">Tech Blog</video>';

    expect(normalizeArticleBodyHtml(linkOnly, "Tech Blog")).toBe(linkOnly);
    expect(normalizeArticleBodyHtml(imageOnly, "Tech Blog")).toBe(imageOnly);
    expect(normalizeArticleBodyHtml(pictureOnly, "Tech Blog")).toBe(pictureOnly);
    expect(normalizeArticleBodyHtml(videoOnly, "Tech Blog")).toBe(videoOnly);
  });

  it("removes only duplicated feed labels before real article content", () => {
    expect(normalizeArticleBodyHtml("<p>Tech Blog：</p><p>Body text</p>", "Tech Blog")).toBe("<p>Body text</p>");
    expect(normalizeArticleBodyHtml("<p>Tech Blog｜</p><p>Body text</p>", "Tech Blog")).toBe("<p>Body text</p>");
  });

  it("normalizes null body text to an empty string", () => {
    expect(normalizeArticleBodyHtml("<p> null </p>")).toBe("");
  });

  it("keeps empty and whitespace-only saved content renderable as an empty fallback", () => {
    expect(normalizeArticleBodyHtml("   ")).toBe("   ");
    expect(stripHtmlTags(normalizeArticleBodyHtml("   "))).toBe("");
  });
});
