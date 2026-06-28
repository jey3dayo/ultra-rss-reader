import { describe, expect, it } from "vitest";
import { getSidebarDensityTokens } from "@/components/reader/sidebar-density";

describe("getSidebarDensityTokens", () => {
  it("returns progressively larger tokens from compact to spacious", () => {
    const compact = getSidebarDensityTokens("compact");
    const normal = getSidebarDensityTokens("normal");
    const spacious = getSidebarDensityTokens("spacious");

    expect(compact.navButton).toContain("min-h-8");
    expect(normal.navButton).toContain("min-h-9");
    expect(spacious.navButton).toContain("min-h-11");
    expect(compact.navButtonPaddingX).toContain("px-1.5");
    expect(compact.treeRootPadding).toContain("pl-3");
    expect(normal.treeInset).toContain("ml-2");
    expect(spacious.sectionLabelInset).toContain("px-3");

    expect(compact.treeGap).toContain("space-y-0");
    expect(normal.treeGap).toContain("space-y-0");
    expect(spacious.treeGap).toContain("space-y-1");
  });

  it("keeps compact feed tree dense while reserving tree gutter space", () => {
    const compact = getSidebarDensityTokens("compact");

    expect(compact.navButton).toContain("min-h-8");
    expect(compact.leadingControl).toBe("size-8");
    expect(compact.treeRootPadding).toBe("pl-3 pr-0");
    expect(compact.treeInset).toBe("ml-2 pl-3");
    expect(compact.tagListGap).toBe("space-y-0");
  });
});
