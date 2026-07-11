import type { SanitizedArticleHtmlDto } from "@/api/schemas/article";

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

/**
 * Strip HTML tags from a string and return plain text.
 *
 * Uses DOMParser when available (browser), falls back to regex for
 * environments where DOMParser is not present (e.g. tests without jsdom).
 */
export function stripHtmlTags(html: string): string {
  if (!html) return "";

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

function parseIpv4Address(hostname: string): number[] | null {
  const parts = hostname.split(".");
  if (parts.length !== 4) {
    return null;
  }

  const octets = parts.map((part) => {
    if (!/^\d{1,3}$/.test(part)) {
      return null;
    }

    const octet = Number(part);
    return Number.isInteger(octet) && octet >= 0 && octet <= 255 ? octet : null;
  });

  return octets.every((octet): octet is number => octet !== null) ? octets : null;
}

function isPrivateIpv4Address(octets: number[]): boolean {
  const [first, second] = octets;
  return (
    first === 10 ||
    first === 127 ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 0 && second === 0) ||
    first >= 224
  );
}

function extractIpv4MappedAddress(hostname: string): string | null {
  if (!hostname.includes(":")) {
    return null;
  }

  const lastColonIndex = hostname.lastIndexOf(":");
  const tail = hostname.slice(lastColonIndex + 1);
  const head = hostname.slice(0, lastColonIndex);

  // Dotted-quad form, e.g. "::ffff:127.0.0.1" -> head "::ffff", tail "127.0.0.1"
  if (tail.includes(".")) {
    if (!/^(::ffff:|::ffff:0:)$/i.test(`${head}:`)) {
      return null;
    }
    return tail;
  }

  // Hextet form, e.g. "::ffff:7f00:1" -> groups ["ffff", "7f00", "1"]
  const groups = hostname.split(":");
  if (groups.length < 4) {
    return null;
  }
  const [hiHex, loHex] = groups.slice(-2);
  const prefixGroups = groups.slice(0, -3);
  const mappedMarker = groups.at(-3);
  if (mappedMarker?.toLowerCase() !== "ffff" || !prefixGroups.every((group) => group === "")) {
    return null;
  }
  if (!hiHex || !loHex || !/^[0-9a-f]{1,4}$/i.test(hiHex) || !/^[0-9a-f]{1,4}$/i.test(loHex)) {
    return null;
  }

  const hi = Number.parseInt(hiHex, 16);
  const lo = Number.parseInt(loHex, 16);
  return `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`;
}

function isPrivateHostname(hostname: string): boolean {
  const normalizedHostname = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    normalizedHostname === "localhost" ||
    normalizedHostname.endsWith(".localhost") ||
    normalizedHostname === "::1" ||
    (normalizedHostname.includes(":") &&
      (normalizedHostname.startsWith("fc") || normalizedHostname.startsWith("fd"))) ||
    normalizedHostname.startsWith("fe80:")
  ) {
    return true;
  }

  const mappedIpv4 = extractIpv4MappedAddress(normalizedHostname);
  if (mappedIpv4 !== null) {
    const mappedOctets = parseIpv4Address(mappedIpv4);
    if (mappedOctets !== null && isPrivateIpv4Address(mappedOctets)) {
      return true;
    }
  }

  const ipv4Address = parseIpv4Address(normalizedHostname);
  return ipv4Address !== null && isPrivateIpv4Address(ipv4Address);
}

function parseReaderContentUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function isSafeReaderContentUrl(url: URL, allowedProtocols: ReadonlySet<string>): boolean {
  return allowedProtocols.has(url.protocol) && !url.username && !url.password && !isPrivateHostname(url.hostname);
}

const ARTICLE_LINK_PROTOCOLS = new Set(["http:", "https:"]);
const ARTICLE_IMAGE_PROTOCOLS = new Set(["https:"]);

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

  if (!normalizedValue.startsWith("//") && !/^[a-z][a-z\d+.-]*:/i.test(normalizedValue)) {
    return true;
  }

  const url = parseReaderContentUrl(normalizedValue);
  return url !== null && isSafeReaderContentUrl(url, ARTICLE_LINK_PROTOCOLS);
}

function safeSrcsetCandidates(value: string): string {
  return value
    .split(",")
    .map((candidate) => candidate.trim())
    .filter((candidate) => {
      const [url] = candidate.split(/\s+/, 1);
      return normalizeReaderContentImageUrl(url) !== null;
    })
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
  doc.body.querySelectorAll("source[srcset]").forEach((source) => {
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

  return doc.body.innerHTML;
}
