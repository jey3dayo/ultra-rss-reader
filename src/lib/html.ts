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
    const text = doc.body.textContent ?? "";
    // Normalize non-breaking spaces and collapse whitespace
    return text
      .replace(/\u00A0/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  // Fallback: regex-based stripping
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeVisibleText(text: string): string {
  return text.replace(/\u00A0/g, " ").replace(/\s+/g, " ").trim();
}

export function stripLeadingDuplicateLabel(html: string, label?: string | null): string {
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

  if (normalizeVisibleText(firstMeaningfulNode.textContent ?? "") !== normalizedLabel) {
    return html;
  }

  if (
    firstMeaningfulNode instanceof Element &&
    firstMeaningfulNode.querySelector("img, picture, video, iframe, object, embed, svg, a, button")
  ) {
    return html;
  }

  firstMeaningfulNode.remove();

  while (body.firstChild && normalizeVisibleText(body.firstChild.textContent ?? "") === "") {
    body.firstChild.remove();
  }

  return body.innerHTML;
}
