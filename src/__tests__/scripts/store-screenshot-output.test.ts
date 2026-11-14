import { describe, expect, it } from "vitest";
import { planOutputs, readImageSize, resolveOsSuffix } from "../../../scripts/lib/store-screenshot-output.ts";

const paths = (platform: NodeJS.Platform, mode: "trial" | "publish") =>
  planOutputs(platform, mode).map((output) => output.path);

describe("resolveOsSuffix", () => {
  it("maps darwin and win32 and rejects everything else", () => {
    expect(resolveOsSuffix("darwin")).toBe("mac");
    expect(resolveOsSuffix("win32")).toBe("windows");
    expect(resolveOsSuffix("linux")).toBeNull();
  });
});

describe("planOutputs", () => {
  it("writes PNG and JPG for both themes under tmp/ on a trial run, whatever the OS", () => {
    const expected = (suffix: string) => [
      `tmp/screenshots/store/screenshot-reader-light-${suffix}.png`,
      `tmp/screenshots/store/screenshot-reader-light-${suffix}.jpg`,
      `tmp/screenshots/store/screenshot-reader-dark-${suffix}.png`,
      `tmp/screenshots/store/screenshot-reader-dark-${suffix}.jpg`,
    ];

    expect(paths("darwin", "trial")).toEqual(expected("mac"));
    expect(paths("win32", "trial")).toEqual(expected("windows"));
    expect(paths("linux", "trial")).toEqual(expected("linux"));
    expect(planOutputs("win32", "trial").every((output) => output.copyTo.length === 0)).toBe(true);
  });

  it("publishes only JPGs on macOS, mirrored into site/assets", () => {
    const outputs = planOutputs("darwin", "publish");

    expect(outputs.map((output) => output.path)).toEqual([
      "docs/assets/screenshot-reader-light-mac.jpg",
      "docs/assets/screenshot-reader-dark-mac.jpg",
    ]);
    expect(outputs.map((output) => output.copyTo)).toEqual([
      ["site/assets/screenshot-reader-light-mac.jpg"],
      ["site/assets/screenshot-reader-dark-mac.jpg"],
    ]);
  });

  it("publishes the Store PNGs and the LP JPGs on Windows", () => {
    const outputs = planOutputs("win32", "publish");

    expect(outputs.map((output) => output.path)).toEqual([
      "docs/assets/store/screenshot-reader-light-windows.png",
      "docs/assets/screenshot-reader-light-windows.jpg",
      "docs/assets/store/screenshot-reader-dark-windows.png",
      "docs/assets/screenshot-reader-dark-windows.jpg",
    ]);
    expect(outputs.filter((output) => output.format === "png").every((output) => output.copyTo.length === 0)).toBe(
      true,
    );
    expect(outputs.filter((output) => output.format === "jpg").flatMap((output) => output.copyTo)).toEqual([
      "site/assets/screenshot-reader-light-windows.jpg",
      "site/assets/screenshot-reader-dark-windows.jpg",
    ]);
  });

  it("rejects publish on an OS without a file-name suffix", () => {
    expect(() => planOutputs("linux", "publish")).toThrow(/only supported on macOS and Windows/);
  });
});

function pngHeader(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(33);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const view = new DataView(bytes.buffer);
  view.setUint32(8, 13);
  bytes.set([0x49, 0x48, 0x44, 0x52], 12);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return bytes;
}

function jpegWithSof(width: number, height: number): Uint8Array {
  // SOI, an APP0 segment to skip, then SOF0 carrying the dimensions.
  const bytes = new Uint8Array(2 + 10 + 9);
  const view = new DataView(bytes.buffer);
  bytes.set([0xff, 0xd8]);
  bytes.set([0xff, 0xe0], 2);
  view.setUint16(4, 8);
  bytes.set([0xff, 0xc0], 12);
  view.setUint16(14, 8);
  bytes[16] = 8;
  view.setUint16(17, height);
  view.setUint16(19, width);
  return bytes;
}

describe("readImageSize", () => {
  it("reads PNG dimensions from IHDR", () => {
    expect(readImageSize(pngHeader(3200, 1800))).toEqual({ width: 3200, height: 1800 });
  });

  it("reads JPEG dimensions from the SOF marker after skipping other segments", () => {
    expect(readImageSize(jpegWithSof(3200, 1800))).toEqual({ width: 3200, height: 1800 });
  });

  it("rejects data that is neither PNG nor JPEG", () => {
    expect(() => readImageSize(new Uint8Array([1, 2, 3, 4, 5]))).toThrow(/Unsupported or truncated/);
  });
});
