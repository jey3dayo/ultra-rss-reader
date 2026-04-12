import { BROWSER_WEBVIEW_DEFAULT_SCALE_FACTOR } from "@/constants/browser";

export type BrowserWebviewBounds = {
  // These bounds are measured from the app webview viewport.
  // When `unit` is omitted they are logical CSS pixels; Windows can opt into physical pixels to avoid DPI drift.
  x: number;
  y: number;
  width: number;
  height: number;
  unit?: "logical" | "physical";
};

type BrowserWebviewBoundsOptions = {
  unit?: "logical" | "physical";
  scaleFactor?: number;
};

export function toBrowserWebviewBounds(
  rect: DOMRect,
  {
    unit = "logical",
    scaleFactor = typeof window === "undefined"
      ? BROWSER_WEBVIEW_DEFAULT_SCALE_FACTOR
      : window.devicePixelRatio || BROWSER_WEBVIEW_DEFAULT_SCALE_FACTOR,
  }: BrowserWebviewBoundsOptions = {},
): BrowserWebviewBounds | null {
  if (rect.width <= 0 || rect.height <= 0) {
    return null;
  }

  const multiplier = unit === "physical" ? scaleFactor : BROWSER_WEBVIEW_DEFAULT_SCALE_FACTOR;
  const width = Math.round(rect.width * multiplier);
  const height = Math.round(rect.height * multiplier);
  if (width <= 0 || height <= 0) {
    return null;
  }

  return {
    x: Math.round(rect.left * multiplier),
    y: Math.round(rect.top * multiplier),
    width,
    height,
    ...(unit === "physical" ? { unit } : {}),
  };
}
