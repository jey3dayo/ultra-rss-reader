import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveDevWebPreviewGeometryUrl } from "@/dev/web-preview-geometry";

describe("dev-web-preview-geometry", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("resolves the preview page against the current browser origin", () => {
    expect(resolveDevWebPreviewGeometryUrl()).toBe(
      new URL("/dev-web-preview-geometry.html", window.location.origin).toString(),
    );
  });

  it("returns the preview path when window is unavailable", () => {
    vi.stubGlobal("window", undefined);

    expect(resolveDevWebPreviewGeometryUrl()).toBe("/dev-web-preview-geometry.html");
  });
});
