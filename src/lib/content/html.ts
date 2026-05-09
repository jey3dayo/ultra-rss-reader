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
    .replace(/<(script|style)\b[^>]*>[\s\S]*?(?:<\/\1>|$)/gi, "")
    .replace(/<(br|p|div|section|article|header|footer|main|aside|blockquote|pre|li|ul|ol|h[1-6])\b[^>]*\/?>/gi, " ")
    .replace(/<\/(p|div|section|article|header|footer|main|aside|blockquote|pre|li|ul|ol|h[1-6])>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(
      /&(?:#(\d+)|#x([\da-f]+)|amp|lt|gt|quot|apos|nbsp);/gi,
      (entity, decimal: string | undefined, hex: string | undefined) => {
        if (decimal || hex) {
          const codePoint = Number.parseInt(decimal ?? hex ?? "", decimal ? 10 : 16);
          return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : entity;
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
  return text === label || text === `${label}:` || text === `${label}｜` || text === `${label} -`;
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

  const firstMeaningfulNode = Array.from(body.childNodes).find((node) => normalizeVisibleText(node.textContent ?? ""));
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
    (node) => node !== firstMeaningfulNode && normalizeVisibleText(node.textContent ?? ""),
  );
  if (!hasRemainingMeaningfulContent) {
    return html;
  }

  firstMeaningfulNode.remove();

  while (body.firstChild && normalizeVisibleText(body.firstChild.textContent ?? "") === "") {
    body.firstChild.remove();
  }

  return body.innerHTML;
}

export function normalizeArticleBodyHtml(html: string, label?: string | null): string {
  const normalizedHtml = stripLeadingDuplicateLabel(html, label);
  return stripHtmlTags(normalizedHtml).toLowerCase() === "null" ? "" : normalizedHtml;
}
