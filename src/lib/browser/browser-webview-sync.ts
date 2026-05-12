import type { BrowserWebviewState, PlatformInfo } from "@/api/schemas";
import { type BrowserWebviewBounds, toBrowserWebviewBounds } from "@/lib/browser/browser-webview";

type BrowserWebviewHostRef = {
  current: HTMLDivElement | null;
};

export function resolveBrowserOverlayClientRelativeRect(element: HTMLElement, rect: DOMRect): DOMRect {
  const overlayRoot =
    element.closest<HTMLElement>("[data-browser-overlay-client-root]") ??
    element.closest<HTMLElement>("[data-browser-overlay-root]");
  const rootRect = overlayRoot?.getBoundingClientRect();
  if (!rootRect) {
    return rect;
  }

  return new DOMRect(rect.left - rootRect.left, rect.top - rootRect.top, rect.width, rect.height);
}

export function resolveBrowserWebviewBounds(
  hostRef: BrowserWebviewHostRef,
  platformKind: PlatformInfo["kind"],
): BrowserWebviewBounds | null {
  const host = hostRef.current;
  if (!host) {
    return null;
  }
  const rect = host.getBoundingClientRect();

  return toBrowserWebviewBounds(resolveBrowserOverlayClientRelativeRect(host, rect), {
    unit: platformKind === "windows" ? "physical" : "logical",
  });
}

export function shouldApplySyncedBrowserState(
  previousState: BrowserWebviewState | null,
  requestedUrl: string,
  nextState: BrowserWebviewState,
): boolean {
  if (nextState.url !== requestedUrl) {
    return false;
  }

  return !previousState || (previousState.url === requestedUrl && (previousState.is_loading || !nextState.is_loading));
}
