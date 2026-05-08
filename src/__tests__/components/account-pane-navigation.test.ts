import { describe, expect, it } from "vitest";
import { normalizePaneNavigationKey } from "@/components/reader/account-pane-navigation";

describe("account-pane-navigation", () => {
  it("normalizes legacy and standard pane navigation keys", () => {
    expect(normalizePaneNavigationKey("ArrowDown")).toBe("ArrowDown");
    expect(normalizePaneNavigationKey("Down")).toBe("ArrowDown");
    expect(normalizePaneNavigationKey("ArrowUp")).toBe("ArrowUp");
    expect(normalizePaneNavigationKey("Up")).toBe("ArrowUp");
    expect(normalizePaneNavigationKey("ArrowRight")).toBe("ArrowRight");
    expect(normalizePaneNavigationKey("Right")).toBe("ArrowRight");
    expect(normalizePaneNavigationKey("Escape")).toBe("Escape");
    expect(normalizePaneNavigationKey("Enter")).toBe("Enter");
  });

  it("ignores keys that do not navigate panes", () => {
    expect(normalizePaneNavigationKey("ArrowLeft")).toBeNull();
    expect(normalizePaneNavigationKey("Tab")).toBeNull();
    expect(normalizePaneNavigationKey("")).toBeNull();
  });
});
