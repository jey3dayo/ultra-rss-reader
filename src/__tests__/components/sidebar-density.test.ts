import { describe, expect, it } from "vitest";
import { getSidebarDensityTokens } from "@/components/reader/sidebar-density";

describe("getSidebarDensityTokens", () => {
  it("returns progressively larger tokens from compact to spacious", () => {
    const compact = getSidebarDensityTokens("compact");
    const normal = getSidebarDensityTokens("normal");
    const spacious = getSidebarDensityTokens("spacious");

    expect(compact.navButton).toContain("min-h-8");
    expect(normal.navButton).toContain("min-h-9");
    expect(spacious.navButton).toContain("min-h-10");

    expect(compact.treeGap).toContain("space-y-0");
    expect(normal.treeGap).toContain("space-y-0.5");
    expect(spacious.treeGap).toContain("space-y-1");
  });
});
