import type { RefObject } from "react";
import type { BrowserWebviewState } from "@/api/tauri-commands";
import { type BrowserWebviewBounds, toBrowserWebviewBounds } from "@/lib/browser-webview";

export function resolveBrowserWebviewBounds(
  hostRef: RefObject<HTMLDivElement | null>,
  platformKind: string,
): BrowserWebviewBounds | null {
  const rect = hostRef.current?.getBoundingClientRect();
  if (!rect) {
    return null;
  }

  return toBrowserWebviewBounds(rect, {
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
