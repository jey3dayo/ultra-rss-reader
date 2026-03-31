import { describe, expect, it } from "vitest";
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

  it("mobile+list: -100%", () => {
    expect(computeTranslateX("mobile", "list")).toBe("-100%");
  });

  it("mobile+content: -200%", () => {
    expect(computeTranslateX("mobile", "content")).toBe("-200%");
  });

  it("compact+sidebar: 0px", () => {
    expect(computeTranslateX("compact", "sidebar")).toBe("0px");
  });

  it("compact+list: 0px", () => {
    expect(computeTranslateX("compact", "list")).toBe("0px");
  });

  it("compact+content: -280px", () => {
    expect(computeTranslateX("compact", "content")).toBe("-280px");
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
    expect(resolveResponsiveLayoutMode("wide", 900)).toBe("compact");
  });

  it("downgrades compact layout to mobile on very small screens", () => {
    expect(resolveResponsiveLayoutMode("compact", 420)).toBe("mobile");
  });
});
