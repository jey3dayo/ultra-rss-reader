import { describe, expect, it } from "vitest";
import { resolvePreferredLayoutMode } from "@/hooks/use-breakpoint";

describe("resolvePreferredLayoutMode", () => {
  it("treats automatic and invalid saved layout values as wide", () => {
    expect(resolvePreferredLayoutMode("automatic")).toBe("wide");
    expect(resolvePreferredLayoutMode("wide")).toBe("wide");
    expect(resolvePreferredLayoutMode("unexpected")).toBe("wide");
  });

  it("preserves compact as the only compact preference", () => {
    expect(resolvePreferredLayoutMode("compact")).toBe("compact");
  });
});
