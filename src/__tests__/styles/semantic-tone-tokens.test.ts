import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const GLOBAL_CSS_PATH = resolve(process.cwd(), "src/styles/global.css");

describe("semantic tone tokens", () => {
  it("defines unread and starred tone tokens for both light and dark themes", () => {
    const css = readFileSync(GLOBAL_CSS_PATH, "utf-8");

    const lightRootMatch = css.match(/:root\s*\{[\s\S]*?\n\}/);
    const darkRootMatch = css.match(/:root\.dark\s*\{[\s\S]*?\n\}/);

    expect(lightRootMatch?.[0]).toContain("--tone-unread:");
    expect(lightRootMatch?.[0]).toContain("--tone-loading:");
    expect(lightRootMatch?.[0]).toContain("--tone-starred:");
    expect(lightRootMatch?.[0]).toContain("--tone-foreground-strength:");
    expect(lightRootMatch?.[0]).toContain("--tone-surface-strength:");
    expect(lightRootMatch?.[0]).toContain("--sidebar-selection-background:");
    expect(lightRootMatch?.[0]).toContain("--sidebar-selection-foreground:");
    expect(lightRootMatch?.[0]).toContain("--sidebar-selection-border:");
    expect(lightRootMatch?.[0]).toContain("--sidebar-selection-muted:");
    expect(lightRootMatch?.[0]).toContain("--sidebar-hover-surface:");
    expect(lightRootMatch?.[0]).toContain("--sidebar-pressed-surface:");
    expect(lightRootMatch?.[0]).toContain("--sidebar-frame-surface:");
    expect(lightRootMatch?.[0]).toContain("--sidebar-frame-solid-surface:");
    expect(lightRootMatch?.[0]).toContain("--sidebar-frame-border:");
    expect(lightRootMatch?.[0]).toContain("--sidebar-divider-strong:");
    expect(lightRootMatch?.[0]).toContain("--reader-context-border:");

    expect(darkRootMatch?.[0]).toContain("--tone-unread:");
    expect(darkRootMatch?.[0]).toContain("--tone-loading:");
    expect(darkRootMatch?.[0]).toContain("--tone-starred:");
    expect(darkRootMatch?.[0]).toContain("--tone-foreground-strength:");
    expect(darkRootMatch?.[0]).toContain("--tone-surface-strength:");
    expect(darkRootMatch?.[0]).toContain("--sidebar-selection-background:");
    expect(darkRootMatch?.[0]).toContain("--sidebar-selection-foreground:");
    expect(darkRootMatch?.[0]).toContain("--sidebar-selection-border:");
    expect(darkRootMatch?.[0]).toContain("--sidebar-selection-muted:");
    expect(darkRootMatch?.[0]).toContain("--sidebar-hover-surface:");
    expect(darkRootMatch?.[0]).toContain("--sidebar-pressed-surface:");
    expect(darkRootMatch?.[0]).toContain("--sidebar-frame-surface:");
    expect(darkRootMatch?.[0]).toContain("--sidebar-frame-solid-surface:");
    expect(darkRootMatch?.[0]).toContain("--sidebar-frame-border:");
    expect(darkRootMatch?.[0]).toContain("--sidebar-divider-strong:");
    expect(darkRootMatch?.[0]).toContain("--reader-context-border:");
  });
});
