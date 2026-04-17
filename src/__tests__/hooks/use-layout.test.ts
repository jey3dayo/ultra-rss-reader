import { describe, expect, it } from "vitest";
import {
  ARTICLE_LIST_PANE_WIDTH_PX,
  COMPACT_LAYOUT_BREAKPOINT_PX,
  MOBILE_LAYOUT_BREAKPOINT_PX,
  SIDEBAR_PANE_WIDTH_PX,
} from "@/constants/ui-layout";
import { computeTranslateX, isPaneVisible, resolveLayout, resolveResponsiveLayoutMode } from "../../hooks/use-layout";

describe("resolveLayout", () => {
  it("wide: 3 panes", () => {
    expect(resolveLayout("wide", "sidebar", "reader")).toEqual(["sidebar", "list", "content"]);
  });

  it("wide+browser: keeps the reader layout because browsing happens in a separate window", () => {
    expect(resolveLayout("wide", "sidebar", "browser")).toEqual(["sidebar", "list", "content"]);
  });

  it("compact+sidebar: sidebar+list", () => {
    expect(resolveLayout("compact", "sidebar", "reader")).toEqual(["sidebar", "list"]);
  });

  it("compact+content: list+content", () => {
    expect(resolveLayout("compact", "content", "reader")).toEqual(["list", "content"]);
  });

  it("mobile: single pane", () => {
    expect(resolveLayout("mobile", "list", "reader")).toEqual(["list"]);
  });
});

describe("computeTranslateX", () => {
  it("mobile+sidebar: 0%", () => {
    expect(computeTranslateX("mobile", "sidebar")).toBe("0%");
  });

  it("mobile+list: shifts by one pane width", () => {
    expect(computeTranslateX("mobile", "list")).toBe("calc(-100% / 3)");
  });

  it("mobile+content: shifts by two pane widths", () => {
    expect(computeTranslateX("mobile", "content")).toBe("calc(-200% / 3)");
  });

  it("compact+sidebar: 0px", () => {
    expect(computeTranslateX("compact", "sidebar")).toBe("0px");
  });

  it("compact+list: 0px", () => {
    expect(computeTranslateX("compact", "list")).toBe("0px");
  });

  it("compact+content: -280px", () => {
    expect(computeTranslateX("compact", "content")).toBe(`-${SIDEBAR_PANE_WIDTH_PX}px`);
  });
});

describe("isPaneVisible", () => {
  describe("mobile", () => {
    it.each([
      ["sidebar", "sidebar", true],
      ["sidebar", "list", false],
      ["sidebar", "content", false],
      ["list", "sidebar", false],
      ["list", "list", true],
      ["list", "content", false],
      ["content", "sidebar", false],
      ["content", "list", false],
      ["content", "content", true],
    ] as const)("focusedPane=%s pane=%s → %s", (focusedPane, pane, expected) => {
      expect(isPaneVisible("mobile", focusedPane, pane)).toBe(expected);
    });
  });

  describe("compact", () => {
    it.each([
      ["sidebar", "sidebar", true],
      ["sidebar", "list", true],
      ["sidebar", "content", false],
      ["list", "sidebar", true],
      ["list", "list", true],
      ["list", "content", false],
      ["content", "sidebar", false],
      ["content", "list", true],
      ["content", "content", true],
    ] as const)("focusedPane=%s pane=%s → %s", (focusedPane, pane, expected) => {
      expect(isPaneVisible("compact", focusedPane, pane)).toBe(expected);
    });
  });
});

describe("resolveResponsiveLayoutMode", () => {
  it("keeps wide layout on sufficiently wide screens", () => {
    expect(resolveResponsiveLayoutMode("wide", 1280)).toBe("wide");
  });

  it("downgrades wide layout to compact when the viewport is too narrow", () => {
    expect(resolveResponsiveLayoutMode("wide", COMPACT_LAYOUT_BREAKPOINT_PX - 200)).toBe("compact");
  });

  it("downgrades compact layout to mobile on small screens before the compact split gets too cramped", () => {
    expect(resolveResponsiveLayoutMode("compact", MOBILE_LAYOUT_BREAKPOINT_PX - 140)).toBe("mobile");
    expect(resolveResponsiveLayoutMode("wide", MOBILE_LAYOUT_BREAKPOINT_PX - 1)).toBe("mobile");
    expect(resolveResponsiveLayoutMode("compact", MOBILE_LAYOUT_BREAKPOINT_PX - 220)).toBe("mobile");
  });

  it("keeps 640px-wide screens in compact layout", () => {
    expect(resolveResponsiveLayoutMode("compact", MOBILE_LAYOUT_BREAKPOINT_PX)).toBe("compact");
  });

  it("uses the shared pane width constants for the desktop layout contract", () => {
    expect(SIDEBAR_PANE_WIDTH_PX).toBe(280);
    expect(ARTICLE_LIST_PANE_WIDTH_PX).toBe(380);
  });
});
