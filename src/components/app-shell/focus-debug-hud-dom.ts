import { describeDebugHudActiveElement } from "@/lib/debug/debug-hud-active-element";

type DebugHudDocumentBoundary = {
  readonly activeElement?: unknown;
  readonly body?: unknown;
  readonly defaultView?: (Window & { readonly HTMLElement?: typeof HTMLElement }) | null;
};

function isDebugHudHtmlElement(value: unknown, ownerDocument: DebugHudDocumentBoundary): value is HTMLElement {
  const HtmlElement: typeof HTMLElement | null =
    ownerDocument.defaultView?.HTMLElement ?? (typeof HTMLElement !== "undefined" ? HTMLElement : null);
  return HtmlElement !== null && value instanceof HtmlElement;
}

export function resolveFocusDebugHudPortalTarget(
  ownerDocument: DebugHudDocumentBoundary | null | undefined = typeof document === "undefined" ? undefined : document,
): HTMLElement | null {
  if (ownerDocument == null) {
    return null;
  }

  const { body } = ownerDocument;
  return isDebugHudHtmlElement(body, ownerDocument) ? body : null;
}

export function getFocusDebugHudActiveElementDescription(
  ownerDocument: DebugHudDocumentBoundary | null | undefined = typeof document === "undefined" ? undefined : document,
): string {
  if (ownerDocument == null) {
    return "none";
  }

  let activeElement: unknown;
  try {
    activeElement = ownerDocument.activeElement;
  } catch {
    return "none";
  }

  return isDebugHudHtmlElement(activeElement, ownerDocument)
    ? describeDebugHudActiveElement(activeElement)
    : describeDebugHudActiveElement(null);
}
