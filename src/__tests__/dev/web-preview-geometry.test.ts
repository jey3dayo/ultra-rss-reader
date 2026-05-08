import { afterEach, describe, expect, it, vi } from "vitest";
import { createDevWebPreviewGeometryFixture, resolveDevWebPreviewGeometryUrl } from "@/dev/web-preview-geometry";

describe("dev-web-preview-geometry", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("resolves the preview page against the current browser origin", () => {
    expect(resolveDevWebPreviewGeometryUrl()).toBe(
      new URL(createDevWebPreviewGeometryFixture().path, window.location.origin).toString(),
    );
  });

  it("returns the preview path when window is unavailable", () => {
    vi.stubGlobal("window", undefined);

    expect(resolveDevWebPreviewGeometryUrl()).toBe("/dev-web-preview-geometry.html");
  });

  it("generates the static geometry fixture contract", () => {
    expect(createDevWebPreviewGeometryFixture()).toEqual({
      path: "/dev-web-preview-geometry.html",
      summary: {
        title: "native webview should touch both colored rails",
        description: "if either rail disappears or turns into app background, geometry is still wrong",
      },
      rails: {
        left: {
          cssVariable: "--edge-left",
          color: "#2563eb",
          label: "left edge",
        },
        right: {
          cssVariable: "--edge-right",
          color: "#f43f5e",
          label: "right edge",
        },
      },
      checks: [
        {
          title: "Width Check",
          description:
            "The blue and pink rails are pinned to the browser surface edges, not to a centered content column.",
        },
        {
          title: "Chrome Check",
          description:
            "The app close button should float above this page without drifting off-center or getting clipped.",
        },
        {
          title: "Overlay Check",
          description:
            "The top rail should feel intentional but almost invisible, with the page still reading as immersive.",
        },
      ],
    });
  });
});
