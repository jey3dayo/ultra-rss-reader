export type BrowserWebviewBounds = {
  // These bounds are measured from the app webview viewport in logical CSS pixels.
  // The Rust backend passes them through as child-webview rects in the same logical space as window.inner_size().
  x: number;
  y: number;
  width: number;
  height: number;
};

export function toBrowserWebviewBounds(rect: DOMRect): BrowserWebviewBounds | null {
  if (rect.width <= 0 || rect.height <= 0) {
    return null;
  }

  const width = Math.round(rect.width);
  const height = Math.round(rect.height);
  if (width <= 0 || height <= 0) {
    return null;
  }

  return {
    x: Math.round(rect.left),
    y: Math.round(rect.top),
    width,
    height,
  };
}
