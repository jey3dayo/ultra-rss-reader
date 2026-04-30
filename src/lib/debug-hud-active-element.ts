export type DebugHudActiveElementSummary = {
  label: string;
  meta: string;
};

export function describeDebugHudActiveElement(element: Element | null): string {
  if (!(element instanceof HTMLElement)) {
    return "none";
  }

  const parts: string[] = [element.tagName.toLowerCase()];
  if (element.dataset.debugHud !== undefined) {
    parts.push("debug-hud");
  }
  if (element.dataset.articleId) {
    parts.push(`article=${element.dataset.articleId}`);
  }
  if (element.dataset.browserOverlayReturnFocus) {
    parts.push(`return=${element.dataset.browserOverlayReturnFocus}`);
  }
  const role = element.getAttribute("role");
  if (role) {
    parts.push(`role=${role}`);
  }
  const testId = element.dataset.testid;
  if (testId) {
    parts.push(`testid=${testId}`);
  }
  const ariaLabel = element.getAttribute("aria-label");
  if (ariaLabel) {
    parts.push(`label=${ariaLabel}`);
  }

  return parts.join(" | ");
}

export function summarizeDebugHudActiveElementDescription(description: string): DebugHudActiveElementSummary {
  const labelMatch = description.match(/label=(.+)$/);
  const roleMatch = description.match(/role=([^\s|]+)/);
  const elementMatch = description.match(/^([^\s|]+)/);

  const label = labelMatch?.[1]?.trim() ?? description;
  const metaParts = [elementMatch?.[1], roleMatch ? `role=${roleMatch[1]}` : null].filter(Boolean);

  return {
    label,
    meta: metaParts.join(" | "),
  };
}
