import { describe, expect, it } from "vitest";
import { normalizeArticleBodyHtml, stripHtmlTags } from "@/lib/content/html";

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

  it("keeps leading media nodes even when their text matches a feed label suffix", () => {
    const html = '<figure><img src="https://example.com/image.png" alt="">Tech Blog:</figure><p>Body text</p>';

    expect(normalizeArticleBodyHtml(html, "Tech Blog")).toBe(html);
  });

  it("normalizes null body text to an empty string", () => {
    expect(normalizeArticleBodyHtml("<p> null </p>")).toBe("");
  });

  it("keeps empty and whitespace-only saved content renderable as an empty fallback", () => {
    expect(normalizeArticleBodyHtml("   ")).toBe("   ");
    expect(stripHtmlTags(normalizeArticleBodyHtml("   "))).toBe("");
  });
});
