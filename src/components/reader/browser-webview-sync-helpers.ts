import type { RefObject } from "react";
import type { PlatformInfo } from "@/api/schemas";
import type { BrowserWebviewState } from "@/api/tauri-commands";
import { type BrowserWebviewBounds, toBrowserWebviewBounds } from "@/lib/browser/browser-webview";

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
  hostRef: RefObject<HTMLDivElement | null>,
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
  return !previousState || (previousState.url === requestedUrl && (previousState.is_loading || !nextState.is_loading));
}
