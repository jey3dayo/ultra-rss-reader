export type ScreenshotTheme = "light" | "dark";
export type ScreenshotFormat = "png" | "jpg";
export type CaptureMode = "trial" | "publish";

export const SCREENSHOT_THEMES: readonly ScreenshotTheme[] = ["light", "dark"];
export const EXPECTED_IMAGE_SIZE = { width: 3200, height: 1800 } as const;

const TRIAL_OUTPUT_DIR = "tmp/screenshots/store";
const DOCS_ASSETS_DIR = "docs/assets";
const DOCS_STORE_DIR = "docs/assets/store";
const SITE_ASSETS_DIR = "site/assets";

export type PlannedOutput = {
  theme: ScreenshotTheme;
  format: ScreenshotFormat;
  /** Repo-root-relative path, always with forward slashes. */
  path: string;
  /** Repo-root-relative copy destinations (the LP serves `site/assets/`, which mirrors `docs/assets/`). */
  copyTo: string[];
};

/** Maps `process.platform` to the file-name OS suffix. Returns null for platforms without published screenshots. */
export function resolveOsSuffix(platform: NodeJS.Platform): "mac" | "windows" | null {
  if (platform === "darwin") {
    return "mac";
  }
  if (platform === "win32") {
    return "windows";
  }
  return null;
}

function fileName(theme: ScreenshotTheme, suffix: string, format: ScreenshotFormat): string {
  return `screenshot-reader-${theme}-${suffix}.${format}`;
}

/**
 * Decides which files a capture run writes.
 *
 * - trial: PNG and JPG under `tmp/screenshots/store/` on every OS (an unknown OS keeps its `process.platform` as suffix).
 * - publish on macOS: JPG only (`docs/assets/` plus the `site/assets/` copy).
 * - publish on Windows: JPG as on macOS, plus the Store PNG under `docs/assets/store/`.
 * - publish elsewhere: rejected, because a file name without a known OS suffix would be ambiguous.
 */
export function planOutputs(platform: NodeJS.Platform, mode: CaptureMode): PlannedOutput[] {
  const osSuffix = resolveOsSuffix(platform);

  if (mode === "trial") {
    const suffix = osSuffix ?? platform;
    return SCREENSHOT_THEMES.flatMap((theme) =>
      (["png", "jpg"] as const).map((format) => ({
        theme,
        format,
        path: `${TRIAL_OUTPUT_DIR}/${fileName(theme, suffix, format)}`,
        copyTo: [],
      })),
    );
  }

  if (!osSuffix) {
    throw new Error(
      `capture:screenshots:publish is only supported on macOS and Windows (running on "${platform}"). ` +
        "Use capture:screenshots for a trial run.",
    );
  }

  return SCREENSHOT_THEMES.flatMap((theme) => {
    const jpg: PlannedOutput = {
      theme,
      format: "jpg",
      path: `${DOCS_ASSETS_DIR}/${fileName(theme, osSuffix, "jpg")}`,
      copyTo: [`${SITE_ASSETS_DIR}/${fileName(theme, osSuffix, "jpg")}`],
    };
    if (osSuffix !== "windows") {
      return [jpg];
    }
    return [
      {
        theme,
        format: "png" as const,
        path: `${DOCS_STORE_DIR}/${fileName(theme, osSuffix, "png")}`,
        copyTo: [],
      },
      jpg,
    ];
  });
}

export type ImageSize = { width: number; height: number };

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_SOF_MARKERS = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);

/** Reads width/height from a PNG or JPEG header so the capture can verify its output without an image dependency. */
export function readImageSize(buffer: Uint8Array): ImageSize {
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);

  if (buffer.length >= 24 && PNG_SIGNATURE.every((byte, index) => buffer[index] === byte)) {
    return { width: view.getUint32(16), height: view.getUint32(20) };
  }

  if (buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 <= buffer.length) {
      if (buffer[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      const marker = buffer[offset + 1];
      if (marker === 0xff) {
        offset += 1;
        continue;
      }
      if (JPEG_SOF_MARKERS.has(marker)) {
        return { height: view.getUint16(offset + 5), width: view.getUint16(offset + 7) };
      }
      offset += 2 + view.getUint16(offset + 2);
    }
  }

  throw new Error("Unsupported or truncated image data: expected a PNG or JPEG header.");
}
