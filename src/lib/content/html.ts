import type { SanitizedArticleHtmlDto } from "@/api/schemas/article";
import { isHostBlockedByPolicy } from "@/lib/runtime/host-privacy";

declare const sanitizedArticleHtmlBrand: unique symbol;

/**
 * Article body HTML that has crossed the Rust sanitizer boundary as
 * `content_sanitized`.
 */
export type SanitizedArticleHtml = string & {
  readonly [sanitizedArticleHtmlBrand]: true;
};

export function fromSanitizedArticleHtmlDto(article: SanitizedArticleHtmlDto): SanitizedArticleHtml {
  return article.content_sanitized as SanitizedArticleHtml;
}

/**
 * @deprecated Prefer `fromSanitizedArticleHtmlDto` at runtime boundaries. This
 * string helper exists for focused tests and legacy local callers.
 */
export function fromSanitizedArticleHtml(contentSanitized: string): SanitizedArticleHtml {
  return contentSanitized as SanitizedArticleHtml;
}

// Article list rows re-run `stripHtmlTags(summary)` on every render because
// each row subscribes to `focusedPane` (see article-list-item.tsx), so
// list<->reader focus changes re-strip every visible row's summary even
// though the summary text only changes when the article data itself
// changes. Cache by exact input string to skip the DOMParser/regex work on
// repeat calls. Bounded by insertion-order eviction (Map preserves
// insertion order) since summaries are a few hundred bytes to a few KB and
// the cache holds at most STRIP_HTML_TAGS_CACHE_LIMIT entries.
//
// `stripHtmlTags` also runs on full article body HTML via
// `normalizeArticleBodyHtml` below, which is not bounded the same way as a
// summary. Skip caching (key and value) above
// STRIP_HTML_TAGS_CACHE_MAX_INPUT_LENGTH so a handful of large article
// bodies cannot make the cache hold megabytes; the result is still computed
// and returned, just not cached.
const STRIP_HTML_TAGS_CACHE_LIMIT = 500;
const STRIP_HTML_TAGS_CACHE_MAX_INPUT_LENGTH = 16_000;
const stripHtmlTagsCache = new Map<string, string>();

function cacheStripHtmlTagsResult(html: string, result: string): string {
  if (html.length > STRIP_HTML_TAGS_CACHE_MAX_INPUT_LENGTH) {
    return result;
  }

  stripHtmlTagsCache.set(html, result);
  if (stripHtmlTagsCache.size > STRIP_HTML_TAGS_CACHE_LIMIT) {
    const oldestKey = stripHtmlTagsCache.keys().next().value;
    if (oldestKey !== undefined) {
      stripHtmlTagsCache.delete(oldestKey);
    }
  }
  return result;
}

// Text containing neither `<` nor `&` cannot contain a tag or an entity
// reference, so the DOMParser body textContent for it is the input itself:
// whitespace normalization is the only transformation `stripHtmlTagsSlow`
// would apply. Entities are excluded from this fast path so decoding
// behavior is untouched.
const HAS_MARKUP_OR_ENTITY = /[<&]/;

function stripHtmlTagsFastPath(html: string): string {
  return html.replace(/ /g, " ").replace(/\s+/g, " ").trim();
}

export function stripHtmlTags(html: string): string {
  if (!html) return "";

  const cached = stripHtmlTagsCache.get(html);
  if (cached !== undefined) {
    return cached;
  }

  if (!HAS_MARKUP_OR_ENTITY.test(html)) {
    return cacheStripHtmlTagsResult(html, stripHtmlTagsFastPath(html));
  }

  return cacheStripHtmlTagsResult(html, stripHtmlTagsSlow(html));
}

/**
 * Strip HTML tags from a string and return plain text.
 *
 * Uses DOMParser when available (browser), falls back to regex for
 * environments where DOMParser is not present (e.g. tests without jsdom).
 */
function stripHtmlTagsSlow(html: string): string {
  if (typeof DOMParser !== "undefined") {
    const doc = new DOMParser().parseFromString(html, "text/html");
    doc.querySelectorAll("script, style").forEach((node) => {
      node.remove();
    });
    doc
      .querySelectorAll(
        "br, p, div, section, article, header, footer, main, aside, blockquote, pre, li, ul, ol, h1, h2, h3, h4, h5, h6",
      )
      .forEach((node) => {
        node.after(" ");
      });
    const text = doc.body.textContent ?? "";
    // Normalize non-breaking spaces and collapse whitespace
    return text
      .replace(/\u00A0/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  // Fallback: regex-based stripping
  return html
    .replace(/<!\[CDATA\[([\s\S]*?)(?:\]\]>|$)/gi, "$1")
    .replace(/<!--[\s\S]*?(?:-->|$)/g, "")
    .replace(/<(script|style)\b[^>]*>[\s\S]*?(?:<\/\1>|$)/gi, "")
    .replace(/<(br|p|div|section|article|header|footer|main|aside|blockquote|pre|li|ul|ol|h[1-6])\b[^>]*\/?>/gi, " ")
    .replace(/<\/(p|div|section|article|header|footer|main|aside|blockquote|pre|li|ul|ol|h[1-6])>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(
      /&(?:#(\d+)|#x([\da-f]+)|amp|lt|gt|quot|apos|nbsp);/gi,
      (entity, decimal: string | undefined, hex: string | undefined) => {
        if (decimal || hex) {
          const codePoint = Number.parseInt(decimal ?? hex ?? "", decimal ? 10 : 16);
          return Number.isFinite(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff
            ? String.fromCodePoint(codePoint)
            : entity;
        }

        const namedEntities: Record<string, string> = {
          "&amp;": "&",
          "&lt;": "<",
          "&gt;": ">",
          "&quot;": '"',
          "&apos;": "'",
          "&nbsp;": " ",
        };
        return namedEntities[entity.toLowerCase()] ?? entity;
      },
    )
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeVisibleText(text: string): string {
  return text
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isDuplicateLeadingLabelText(text: string, label: string): boolean {
  return (
    text === label || text === `${label}:` || text === `${label}：` || text === `${label}｜` || text === `${label} -`
  );
}

function hasMeaningfulVisibleText(node: ChildNode): boolean {
  return normalizeVisibleText(node.textContent ?? "") !== "";
}

function stripLeadingDuplicateLabel(html: string, label?: string | null): string {
  if (!html || !label || typeof DOMParser === "undefined") {
    return html;
  }

  const normalizedLabel = normalizeVisibleText(label);
  if (!normalizedLabel) {
    return html;
  }

  const doc = new DOMParser().parseFromString(html, "text/html");
  const { body } = doc;

  const firstMeaningfulNode = Array.from(body.childNodes).find(hasMeaningfulVisibleText);
  if (!firstMeaningfulNode) {
    return html;
  }

  if (!isDuplicateLeadingLabelText(normalizeVisibleText(firstMeaningfulNode.textContent ?? ""), normalizedLabel)) {
    return html;
  }

  if (
    firstMeaningfulNode instanceof Element &&
    firstMeaningfulNode.querySelector("img, picture, video, iframe, object, embed, svg, a, button")
  ) {
    return html;
  }

  const hasRemainingMeaningfulContent = Array.from(body.childNodes).some(
    (node) => node !== firstMeaningfulNode && hasMeaningfulVisibleText(node),
  );
  if (!hasRemainingMeaningfulContent) {
    return html;
  }

  firstMeaningfulNode.remove();

  while (body.firstChild && !hasMeaningfulVisibleText(body.firstChild)) {
    body.firstChild.remove();
  }

  return body.innerHTML;
}

export function normalizeArticleBodyHtml(html: string, label?: string | null): string {
  const normalizedHtml = stripLeadingDuplicateLabel(html, label);
  return stripHtmlTags(normalizedHtml).toLowerCase() === "null" ? "" : normalizedHtml;
}

const REDACTED_URL_TITLE = "External link";
const REDACTED_IMAGE_TITLE = "External image";

function parseReaderContentUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function isSafeReaderContentUrl(url: URL, allowedProtocols: ReadonlySet<string>): boolean {
  return (
    allowedProtocols.has(url.protocol) &&
    !url.username &&
    !url.password &&
    !isHostBlockedByPolicy(url.hostname, "automaticRequest")
  );
}

const ARTICLE_LINK_PROTOCOLS = new Set(["http:", "https:"]);
// Kept as a separate set from ARTICLE_LINK_PROTOCOLS (even though the values
// currently match) so images can be scoped independently of links later.
// http: must stay allowed here to match the documented compatibility
// contract (docs/feed-content-privacy.md:23,756) and the Rust sanitizer's
// url_schemes allowlist (src-tauri/src/infra/sanitizer.rs:54), which both
// permit http: article images/thumbnails.
const ARTICLE_IMAGE_PROTOCOLS = new Set(["http:", "https:"]);

export function normalizeReaderContentImageUrl(value: string | null | undefined): string | null {
  const normalizedValue = value?.trim();
  if (!normalizedValue) {
    return null;
  }

  if (normalizedValue.startsWith("/") && !normalizedValue.startsWith("//")) {
    return normalizedValue;
  }

  const url = parseReaderContentUrl(normalizedValue);
  return url && isSafeReaderContentUrl(url, ARTICLE_IMAGE_PROTOCOLS) ? url.href : null;
}

function isSafeReaderContentLinkUrl(value: string): boolean {
  const normalizedValue = value.trim();
  if (!normalizedValue) {
    return false;
  }

  // Browsers strip ASCII tab/newline/carriage-return from a URL before
  // parsing it, so a scheme like "java\tscript:" is interpreted as an
  // absolute "javascript:" URL rather than a relative path. Strip the same
  // control characters before the relative/absolute scheme check so a value
  // like that is classified as absolute and rejected below instead of being
  // misread as relative and left in place.
  const schemeCheckValue = normalizedValue.replace(/[\t\n\r]/g, "");

  if (!normalizedValue.startsWith("//") && !/^[a-z][a-z\d+.-]*:/i.test(schemeCheckValue)) {
    return true;
  }

  const url = parseReaderContentUrl(normalizedValue);
  return url !== null && isSafeReaderContentUrl(url, ARTICLE_LINK_PROTOCOLS);
}

type SrcsetCandidate = { url: string; descriptors: string };

// WHATWG "parse a srcset attribute": URLs may contain commas, and a comma
// only ends a candidate when it trails the URL or sits outside parentheses.
function parseSrcsetCandidates(value: string): SrcsetCandidate[] {
  const candidates: SrcsetCandidate[] = [];
  const isSeparator = (char: string | undefined) => char === "," || (char !== undefined && /\s/.test(char));
  let position = 0;

  while (position < value.length) {
    while (position < value.length && isSeparator(value[position])) {
      position += 1;
    }
    if (position >= value.length) {
      break;
    }

    const urlStart = position;
    while (position < value.length && !/\s/.test(value[position] ?? "")) {
      position += 1;
    }
    let url = value.slice(urlStart, position);
    let descriptors = "";

    if (url.endsWith(",")) {
      url = url.replace(/,+$/, "");
    } else {
      const descriptorStart = position;
      let depth = 0;
      while (position < value.length) {
        const char = value[position];
        if (char === "(") {
          depth += 1;
        } else if (char === ")") {
          depth = Math.max(0, depth - 1);
        } else if (char === "," && depth === 0) {
          break;
        }
        position += 1;
      }
      descriptors = value.slice(descriptorStart, position).trim();
    }

    if (url) {
      candidates.push({ url, descriptors });
    }
  }

  return candidates;
}

function safeSrcsetCandidates(value: string): string {
  return parseSrcsetCandidates(value)
    .filter(({ url }) => normalizeReaderContentImageUrl(url) !== null)
    .map(({ url, descriptors }) => (descriptors ? `${url} ${descriptors}` : url))
    .join(", ");
}

function redactTitleAttribute(element: Element, fallbackTitle: string): void {
  const title = element.getAttribute("title");
  if (!title) {
    return;
  }

  const url = parseReaderContentUrl(title.trim());
  if (url) {
    element.setAttribute("title", fallbackTitle);
  }
}

export function applyReaderContentPrivacyPolicy(html: string): string {
  if (!html || typeof DOMParser === "undefined") {
    return html;
  }

  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.body.querySelectorAll("img[srcset], source[srcset]").forEach((source) => {
    const srcset = source.getAttribute("srcset");
    if (!srcset) {
      return;
    }

    const safeSrcset = safeSrcsetCandidates(srcset);
    if (safeSrcset) {
      source.setAttribute("srcset", safeSrcset);
    } else {
      source.removeAttribute("srcset");
    }
  });
  doc.body.querySelectorAll("img").forEach((image) => {
    const safeImageUrl = normalizeReaderContentImageUrl(image.getAttribute("src"));
    if (safeImageUrl) {
      image.setAttribute("src", safeImageUrl);
    } else {
      image.removeAttribute("src");
    }
    image.setAttribute("referrerpolicy", "no-referrer");
    image.setAttribute("loading", "lazy");
    image.setAttribute("decoding", "async");
    redactTitleAttribute(image, REDACTED_IMAGE_TITLE);
  });
  doc.body.querySelectorAll("a[href]").forEach((anchor) => {
    const href = anchor.getAttribute("href");
    if (!href || !isSafeReaderContentLinkUrl(href)) {
      anchor.removeAttribute("href");
    }
    anchor.setAttribute("rel", "noopener noreferrer");
    redactTitleAttribute(anchor, REDACTED_URL_TITLE);
  });
  // Inline `style` attributes can carry `url(...)` references (e.g.
  // `background-image: url(http://tracker.example/pixel)`) that would load
  // an external resource the same way an unfiltered `img[src]` would. The
  // reader only needs sanitized article text to stay readable, so drop the
  // whole attribute here instead of trying to parse individual style
  // declarations.
  doc.body.querySelectorAll("[style]").forEach((element) => {
    element.removeAttribute("style");
  });

  return doc.body.innerHTML;
}
