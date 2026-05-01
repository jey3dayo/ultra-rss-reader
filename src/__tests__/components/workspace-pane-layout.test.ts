import { describe, expect, it } from "vitest";
import {
  WORKSPACE_CANVAS_CLASS,
  WORKSPACE_CHROME_SPACING_CLASS,
  WORKSPACE_DETAIL_PANE_GRID_CLASS,
  WORKSPACE_DETAIL_PANE_GRID_CLASS_COMPACT,
  WORKSPACE_DETAIL_PANE_WIDTH,
  workspaceSplitGridClassName,
  workspaceSplitShellClassName,
} from "@/components/shared/workspace-pane-layout";

describe("workspace-pane-layout", () => {
  it("exports the shared detail pane sizing tokens", () => {
    expect(WORKSPACE_DETAIL_PANE_WIDTH).toBe(480);
    expect(WORKSPACE_DETAIL_PANE_GRID_CLASS).toContain("480px");
    expect(WORKSPACE_DETAIL_PANE_GRID_CLASS_COMPACT).toContain("480px");
    expect(WORKSPACE_CANVAS_CLASS).toContain("max-w-[1600px]");
    expect(WORKSPACE_CHROME_SPACING_CLASS).toContain("sm:px-5");
  });

  it("builds split shell classes with caller classes appended", () => {
    const className = workspaceSplitShellClassName("custom-shell");

    expect(className).toContain(WORKSPACE_DETAIL_PANE_GRID_CLASS);
    expect(className).toContain("rounded-md");
    expect(className).toContain("custom-shell");
  });

  it("builds split grid classes with compact detail pane sizing", () => {
    const className = workspaceSplitGridClassName("custom-grid");

    expect(className).toContain(WORKSPACE_DETAIL_PANE_GRID_CLASS_COMPACT);
    expect(className).toContain("items-stretch");
    expect(className).toContain("custom-grid");
  });
});
