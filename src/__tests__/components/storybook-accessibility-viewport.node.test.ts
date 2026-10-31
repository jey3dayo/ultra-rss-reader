import { MINIMAL_VIEWPORTS } from "storybook/viewport";
import { describe, expect, it } from "vitest";
import {
  resolveStorybookAccessibilityViewport,
  type StorybookAccessibilityViewportContext,
} from "../../../e2e/storybook/accessibility-viewport";

function viewportContext(
  overrides: Partial<StorybookAccessibilityViewportContext> = {},
): StorybookAccessibilityViewportContext {
  return {
    globals: undefined,
    storyGlobals: undefined,
    userGlobals: undefined,
    parameters: undefined,
    ...overrides,
  };
}

describe("Storybook accessibility viewport resolution", () => {
  it("uses the Storybook 10 built-in viewport options for a selected global", () => {
    const viewport = MINIMAL_VIEWPORTS.mobile2;

    expect(
      resolveStorybookAccessibilityViewport(
        "settings--dense",
        viewportContext({ globals: { viewport: { value: "mobile2" } } }),
      ),
    ).toEqual({
      width: Number.parseInt(viewport.styles.width, 10),
      height: Number.parseInt(viewport.styles.height, 10),
    });
  });

  it("uses story globals before user globals and user globals before initial globals", () => {
    const context = viewportContext({
      globals: { viewport: { value: "desktop" } },
      userGlobals: { viewport: { value: "tablet" } },
      storyGlobals: { viewport: { value: "mobile1" } },
    });

    expect(resolveStorybookAccessibilityViewport("reader--dense", context)).toEqual({
      width: Number.parseInt(MINIMAL_VIEWPORTS.mobile1.styles.width, 10),
      height: Number.parseInt(MINIMAL_VIEWPORTS.mobile1.styles.height, 10),
    });
    expect(
      resolveStorybookAccessibilityViewport(
        "reader--dense",
        viewportContext({
          globals: { viewport: { value: "desktop" } },
          userGlobals: { viewport: { value: "tablet" } },
        }),
      ),
    ).toEqual({
      width: Number.parseInt(MINIMAL_VIEWPORTS.tablet.styles.width, 10),
      height: Number.parseInt(MINIMAL_VIEWPORTS.tablet.styles.height, 10),
    });
  });

  it("uses a story-specific viewport option and rotates its dimensions", () => {
    const context = viewportContext({
      storyGlobals: { viewport: { value: "compact", isRotated: true } },
      parameters: {
        viewport: {
          options: {
            compact: {
              name: "Compact",
              styles: { width: "360px", height: "640px" },
            },
          },
        },
      },
    });

    expect(resolveStorybookAccessibilityViewport("reader--compact", context)).toEqual({
      width: 640,
      height: 360,
    });
  });

  it("falls back to a legacy defaultViewport only when no viewport global selects one", () => {
    const context = viewportContext({
      globals: { viewport: { value: undefined, isRotated: false } },
      parameters: { viewport: { defaultViewport: "mobile1" } },
    });

    expect(resolveStorybookAccessibilityViewport("reader--legacy-mobile", context)).toEqual({
      width: Number.parseInt(MINIMAL_VIEWPORTS.mobile1.styles.width, 10),
      height: Number.parseInt(MINIMAL_VIEWPORTS.mobile1.styles.height, 10),
    });
  });

  it("lets a selected global override the legacy default and carries rotation", () => {
    const context = viewportContext({
      storyGlobals: { viewport: { value: "mobile2", isRotated: true } },
      parameters: { viewport: { defaultViewport: "mobile1" } },
    });

    expect(resolveStorybookAccessibilityViewport("reader--mobile", context)).toEqual({
      width: Number.parseInt(MINIMAL_VIEWPORTS.mobile2.styles.height, 10),
      height: Number.parseInt(MINIMAL_VIEWPORTS.mobile2.styles.width, 10),
    });
  });

  it("returns no override for responsive viewport globals", () => {
    const context = viewportContext({
      globals: { viewport: { value: "100pct-100pct" } },
      parameters: { viewport: { defaultViewport: "mobile2" } },
    });

    expect(resolveStorybookAccessibilityViewport("reader--responsive", context)).toBeUndefined();
  });

  it("resolves Storybook custom pixel dimensions and rotation", () => {
    const context = viewportContext({
      userGlobals: { viewport: { value: "320-480", isRotated: true } },
    });

    expect(resolveStorybookAccessibilityViewport("reader--custom", context)).toEqual({ width: 480, height: 320 });
  });

  it("reports unknown global and legacy viewport ids with the story id", () => {
    expect(() =>
      resolveStorybookAccessibilityViewport(
        "reader--unknown-global",
        viewportContext({ globals: { viewport: { value: "missing-device" } } }),
      ),
    ).toThrow('Story "reader--unknown-global" references unknown viewport id "missing-device"');
    expect(() =>
      resolveStorybookAccessibilityViewport(
        "reader--unknown-legacy",
        viewportContext({ parameters: { viewport: { defaultViewport: "missing-device" } } }),
      ),
    ).toThrow('Story "reader--unknown-legacy" references unknown viewport id "missing-device"');
  });
});
