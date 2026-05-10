import { Result } from "@praha/byethrow";
import { BROWSER_WEBVIEW_DEFAULT_SCALE_FACTOR } from "@/constants/browser";

export type BrowserWebviewBounds = {
  // These bounds are measured from the browser overlay client root.
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

export type BrowserWebviewBoundsError = "empty_rect" | "empty_bounds" | "invalid_scale_factor";

function getDefaultBrowserWebviewScaleFactor(): number {
  if (typeof window === "undefined" || !Number.isFinite(window.devicePixelRatio) || window.devicePixelRatio <= 0) {
    return BROWSER_WEBVIEW_DEFAULT_SCALE_FACTOR;
  }

  return window.devicePixelRatio;
}

export function toBrowserWebviewBoundsResult(
  rect: DOMRect,
  options: BrowserWebviewBoundsOptions = {},
): Result.Result<BrowserWebviewBounds, BrowserWebviewBoundsError> {
  const { unit = "logical", scaleFactor = getDefaultBrowserWebviewScaleFactor() } = options;
  if (rect.width <= 0 || rect.height <= 0) {
    return Result.fail("empty_rect");
  }

  if ((unit === "physical" || "scaleFactor" in options) && (!Number.isFinite(scaleFactor) || scaleFactor <= 0)) {
    return Result.fail("invalid_scale_factor");
  }

  const multiplier = unit === "physical" ? scaleFactor : BROWSER_WEBVIEW_DEFAULT_SCALE_FACTOR;
  const width = Math.round(rect.width * multiplier);
  const height = Math.round(rect.height * multiplier);
  if (width <= 0 || height <= 0) {
    return Result.fail("empty_bounds");
  }

  return Result.succeed({
    x: Math.round(rect.left * multiplier),
    y: Math.round(rect.top * multiplier),
    width,
    height,
    ...(unit === "physical" ? { unit } : {}),
  });
}

export function toBrowserWebviewBounds(
  rect: DOMRect,
  options: BrowserWebviewBoundsOptions = {},
): BrowserWebviewBounds | null {
  const result = toBrowserWebviewBoundsResult(rect, options);
  return Result.isSuccess(result) ? Result.unwrap(result) : null;
}
