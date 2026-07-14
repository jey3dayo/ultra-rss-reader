import { setupBrowserTestDom } from "@tests/helpers/browser-test-globals";
import { describe, expect, it } from "vitest";
import {
  applyReaderContentPrivacyPolicy,
  fromSanitizedArticleHtmlDto,
  normalizeArticleBodyHtml,
  normalizeReaderContentImageUrl,
  stripHtmlTags,
} from "@/lib/content/html";

setupBrowserTestDom();

describe("fromSanitizedArticleHtmlDto", () => {
  it("brands the backend content_sanitized DTO field without accepting raw article body by default", () => {
    const article = {
      content_sanitized: "<p>Backend sanitized body</p>",
    };

    expect(fromSanitizedArticleHtmlDto(article)).toBe(article.content_sanitized);
  });

  it("rejects non-DTO raw content shapes at the type boundary", () => {
    const unsafeDto: Parameters<typeof fromSanitizedArticleHtmlDto>[0] = {
      // @ts-expect-error fromSanitizedArticleHtmlDto requires the backend content_sanitized field.
      content: "<p>Raw unsanitized body</p>",
    };

    expect("content" in unsafeDto).toBe(true);
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
  type PrivacyPolicyCorpusFixture = {
    readonly label: string;
    readonly html: string;
    readonly required: readonly string[];
    readonly forbidden?: readonly string[];
  };

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

  it("blocks secret-bearing and private-host reader content URLs before rendering", () => {
    const normalized = applyReaderContentPrivacyPolicy(
      [
        '<a href="https://user:pass@example.com/article" title="https://user:pass@example.com/article?token=raw">Credential link</a>',
        '<a href="http://127.0.0.1/admin">Private link</a>',
        '<a href="../relative-article">Relative link</a>',
        '<img src="https://192.168.1.20/image.jpg" title="https://192.168.1.20/image.jpg?token=raw" alt="Private image">',
        '<picture><source srcset="https://cdn.example.com/hero.webp 1x, https://10.0.0.1/track.webp 2x"><img src="https://cdn.example.com/hero.jpg" alt="Hero"></picture>',
      ].join(""),
    );

    expect(normalized).toContain('title="External link"');
    expect(normalized).toContain('title="External image"');
    expect(normalized).toContain('<a title="External link" rel="noopener noreferrer">Credential link</a>');
    expect(normalized).toContain('<a rel="noopener noreferrer">Private link</a>');
    expect(normalized).toContain('href="../relative-article"');
    expect(normalized).not.toContain("user:pass");
    expect(normalized).not.toContain("127.0.0.1");
    expect(normalized).not.toContain("192.168.1.20");
    expect(normalized).not.toContain("10.0.0.1");
    expect(normalized).toContain('srcset="https://cdn.example.com/hero.webp 1x"');
    expect(normalized).toContain('loading="lazy"');
    expect(normalized).toContain('decoding="async"');
  });

  it("keeps the frontend post-process aligned with the sanitizer link and media privacy corpus", () => {
    const corpus: readonly PrivacyPolicyCorpusFixture[] = [
      {
        label: "sanitized tracking link",
        html: '<a href="https://publisher.example.com/read?utm_source=feed">Read article</a>',
        required: ['href="https://publisher.example.com/read?utm_source=feed"', 'rel="noopener noreferrer"'],
      },
      {
        label: "sanitized article image",
        html: '<picture><source srcset="https://cdn.example.com/hero.webp 1x"><img src="https://cdn.example.com/hero.jpg" alt="Hero"></picture>',
        required: [
          'src="https://cdn.example.com/hero.jpg"',
          'referrerpolicy="no-referrer"',
          'loading="lazy"',
          'decoding="async"',
        ],
      },
      {
        label: "http article image allowed by CSP but blocked by reader policy",
        html: '<img src="http://cdn.example.com/tracking.gif" alt="Tracking pixel">',
        required: ['alt="Tracking pixel"', 'referrerpolicy="no-referrer"', 'loading="lazy"', 'decoding="async"'],
        forbidden: ['src="http://cdn.example.com/tracking.gif"'],
      },
      {
        label: "sanitized credential-bearing link title",
        html: '<a href="https://example.com/read" title="https://example.com/read?token=raw">Read article</a>',
        required: ['href="https://example.com/read"', 'title="External link"', 'rel="noopener noreferrer"'],
        forbidden: ["token=raw"],
      },
      {
        label: "sanitized private media candidate",
        html: '<picture><source srcset="https://cdn.example.com/hero.webp 1x, https://127.0.0.1/track.webp 2x"><img src="https://localhost/private.jpg" title="https://localhost/private.jpg?token=raw" alt="Private"></picture>',
        required: ['srcset="https://cdn.example.com/hero.webp 1x"', 'title="External image"'],
        forbidden: ["127.0.0.1", "localhost/private.jpg", "token=raw"],
      },
    ];

    for (const fixture of corpus) {
      const normalized = applyReaderContentPrivacyPolicy(fixture.html);

      for (const fragment of fixture.required) {
        expect(normalized, fixture.label).toContain(fragment);
      }
      for (const fragment of fixture.forbidden ?? []) {
        expect(normalized, fixture.label).not.toContain(fragment);
      }
    }
  });

  it("removes an anchor href whose scheme is disguised with a control character (tab-split javascript:)", () => {
    const normalized = applyReaderContentPrivacyPolicy('<a href="java\tscript:alert(1)">Click</a>');

    expect(normalized).not.toContain("href=");
    expect(normalized).not.toContain("javascript:");
    expect(normalized).toContain('rel="noopener noreferrer"');
  });

  it("keeps a safe relative link and a safe absolute link unaffected by the control-character scheme check (regression)", () => {
    const normalized = applyReaderContentPrivacyPolicy(
      '<a href="../relative-article">Relative</a><a href="https://publisher.example.com/read">Absolute</a>',
    );

    expect(normalized).toContain('href="../relative-article"');
    expect(normalized).toContain('href="https://publisher.example.com/read"');
  });

  it("removes the style attribute so an inline background-image url() cannot reach an external tracker", () => {
    const normalized = applyReaderContentPrivacyPolicy(
      '<div style="background-image:url(http://tracker.example/pixel)">Body</div>',
    );

    expect(normalized).not.toContain("style=");
    expect(normalized).not.toContain("tracker.example");
    expect(normalized).toContain("Body");
  });

  it("keeps existing img/srcset privacy rewrites unaffected by the new style-attribute removal (regression)", () => {
    const normalized = applyReaderContentPrivacyPolicy(
      '<picture><source srcset="https://cdn.example.com/hero.webp 1x"><img src="https://cdn.example.com/hero.jpg" alt="Hero" style="width:100%"></picture>',
    );

    expect(normalized).toContain('srcset="https://cdn.example.com/hero.webp 1x"');
    expect(normalized).toContain('src="https://cdn.example.com/hero.jpg"');
    expect(normalized).toContain('referrerpolicy="no-referrer"');
    expect(normalized).not.toContain("style=");
  });
});

describe("normalizeReaderContentImageUrl", () => {
  it("keeps reader thumbnail and body image policy aligned", () => {
    expect(normalizeReaderContentImageUrl("https://cdn.example.com/hero.jpg")).toBe("https://cdn.example.com/hero.jpg");
    expect(normalizeReaderContentImageUrl("/fixture/hero.jpg")).toBe("/fixture/hero.jpg");
    expect(normalizeReaderContentImageUrl("http://cdn.example.com/hero.jpg")).toBeNull();
    expect(normalizeReaderContentImageUrl("https://user:pass@cdn.example.com/hero.jpg")).toBeNull();
    expect(normalizeReaderContentImageUrl("https://localhost/hero.jpg")).toBeNull();
    expect(normalizeReaderContentImageUrl("https://[::1]/hero.jpg")).toBeNull();
  });

  it("blocks IPv4-mapped IPv6 reader image hosts (::ffff:127.0.0.1)", () => {
    expect(normalizeReaderContentImageUrl("https://[::ffff:127.0.0.1]/hero.jpg")).toBeNull();
    expect(normalizeReaderContentImageUrl("https://[::ffff:192.168.1.1]/hero.jpg")).toBeNull();
    expect(normalizeReaderContentImageUrl("https://[::ffff:10.0.0.1]/hero.jpg")).toBeNull();
  });

  it("keeps blocking already-normalized decimal and hex IPv4 reader image hosts (regression)", () => {
    expect(normalizeReaderContentImageUrl("https://2130706433/hero.jpg")).toBeNull();
    expect(normalizeReaderContentImageUrl("https://0x7f000001/hero.jpg")).toBeNull();
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
