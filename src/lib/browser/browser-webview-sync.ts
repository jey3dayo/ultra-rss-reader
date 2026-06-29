import type { BrowserWebviewState, PlatformInfo } from "@/api/schemas";
import { type BrowserWebviewBounds, toBrowserWebviewBounds } from "@/lib/browser/browser-webview";

type BrowserWebviewHostRef = {
  current: HTMLDivElement | null;
};

export function resolveBrowserWebviewBounds(
  hostRef: BrowserWebviewHostRef,
  platformKind: PlatformInfo["kind"],
): BrowserWebviewBounds | null {
  const host = hostRef.current;
  if (!host) {
    return null;
  }
  const rect = host.getBoundingClientRect();

  return toBrowserWebviewBounds(rect, {
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
