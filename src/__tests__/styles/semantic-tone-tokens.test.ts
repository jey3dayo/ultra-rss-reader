import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const GLOBAL_CSS_PATH = resolve(process.cwd(), "src/styles/global.css");

const REQUIRED_SEMANTIC_TONE_TOKENS = [
  "--tone-unread",
  "--tone-loading",
  "--tone-starred",
  "--tone-foreground-strength",
  "--tone-surface-strength",
  "--sidebar-selection-background",
  "--sidebar-selection-foreground",
  "--sidebar-selection-border",
  "--sidebar-selection-muted",
  "--sidebar-hover-surface",
  "--sidebar-selection-gradient",
  "--sidebar-hover-gradient",
  "--sidebar-focus-gradient",
  "--sidebar-pressed-surface",
  "--sidebar-frame-surface",
  "--sidebar-frame-solid-surface",
  "--sidebar-frame-border",
  "--sidebar-divider-strong",
  "--reader-context-border",
] as const;

const REQUIRED_THEME_COLOR_ALIASES = [
  { aliasName: "--color-background", tokenName: "--background" },
  { aliasName: "--color-foreground", tokenName: "--foreground" },
  { aliasName: "--color-foreground-soft", tokenName: "--foreground-soft" },
  { aliasName: "--color-card", tokenName: "--card" },
  { aliasName: "--color-card-foreground", tokenName: "--card-foreground" },
  { aliasName: "--color-popover", tokenName: "--popover" },
  { aliasName: "--color-popover-foreground", tokenName: "--popover-foreground" },
  { aliasName: "--color-primary", tokenName: "--primary" },
  { aliasName: "--color-primary-foreground", tokenName: "--primary-foreground" },
  { aliasName: "--color-text-selection", tokenName: "--text-selection" },
  { aliasName: "--color-text-selection-foreground", tokenName: "--text-selection-foreground" },
  { aliasName: "--color-secondary", tokenName: "--secondary" },
  { aliasName: "--color-secondary-foreground", tokenName: "--secondary-foreground" },
  { aliasName: "--color-muted", tokenName: "--muted" },
  { aliasName: "--color-muted-foreground", tokenName: "--muted-foreground" },
  { aliasName: "--color-accent", tokenName: "--accent" },
  { aliasName: "--color-accent-foreground", tokenName: "--accent-foreground" },
  { aliasName: "--color-destructive", tokenName: "--destructive" },
  { aliasName: "--color-border", tokenName: "--border" },
  { aliasName: "--color-border-strong", tokenName: "--border-strong" },
  { aliasName: "--color-input", tokenName: "--input" },
  { aliasName: "--color-ring", tokenName: "--ring" },
  { aliasName: "--color-sidebar", tokenName: "--sidebar" },
  { aliasName: "--color-sidebar-foreground", tokenName: "--sidebar-foreground" },
  { aliasName: "--color-sidebar-accent", tokenName: "--sidebar-accent" },
  { aliasName: "--color-sidebar-accent-foreground", tokenName: "--sidebar-accent-foreground" },
  { aliasName: "--color-sidebar-border", tokenName: "--sidebar-border" },
  { aliasName: "--color-browser-overlay-shell", tokenName: "--browser-overlay-shell" },
  { aliasName: "--color-browser-overlay-loading-halo", tokenName: "--browser-overlay-loading-halo" },
  { aliasName: "--color-browser-overlay-rail-border", tokenName: "--browser-overlay-rail-border" },
  { aliasName: "--color-browser-overlay-state-detail-surface", tokenName: "--browser-overlay-state-detail-surface" },
  { aliasName: "--color-browser-overlay-state-detail-border", tokenName: "--browser-overlay-state-detail-border" },
  { aliasName: "--color-overlay-action-surface", tokenName: "--overlay-action-surface" },
  { aliasName: "--color-overlay-action-surface-hover", tokenName: "--overlay-action-surface-hover" },
  { aliasName: "--color-overlay-action-surface-focus", tokenName: "--overlay-action-surface-focus" },
  { aliasName: "--color-overlay-action-surface-subtle", tokenName: "--overlay-action-surface-subtle" },
  { aliasName: "--color-overlay-action-surface-chrome-hover", tokenName: "--overlay-action-surface-chrome-hover" },
  { aliasName: "--color-overlay-action-surface-chrome-active", tokenName: "--overlay-action-surface-chrome-active" },
  { aliasName: "--color-state-warning-surface", tokenName: "--state-warning-surface" },
  { aliasName: "--color-state-warning-border", tokenName: "--state-warning-border" },
  { aliasName: "--color-state-warning-foreground", tokenName: "--state-warning-foreground" },
  { aliasName: "--color-state-success-surface", tokenName: "--state-success-surface" },
  { aliasName: "--color-state-success-border", tokenName: "--state-success-border" },
  { aliasName: "--color-state-success-foreground", tokenName: "--state-success-foreground" },
  { aliasName: "--color-state-review-surface", tokenName: "--state-review-surface" },
  { aliasName: "--color-state-review-border", tokenName: "--state-review-border" },
  { aliasName: "--color-state-review-foreground", tokenName: "--state-review-foreground" },
  { aliasName: "--color-state-danger-surface", tokenName: "--state-danger-surface" },
  { aliasName: "--color-state-danger-border", tokenName: "--state-danger-border" },
  { aliasName: "--color-state-danger-foreground", tokenName: "--state-danger-foreground" },
  { aliasName: "--color-dialog-overlay", tokenName: "--dialog-overlay" },
  { aliasName: "--color-dialog-overlay-readable", tokenName: "--dialog-overlay-readable" },
  { aliasName: "--color-dialog-scrim", tokenName: "--dialog-overlay" },
  { aliasName: "--color-dialog-scrim-readable", tokenName: "--dialog-overlay-readable" },
  { aliasName: "--color-surface-1", tokenName: "--surface-1" },
  { aliasName: "--color-surface-2", tokenName: "--surface-2" },
  { aliasName: "--color-surface-3", tokenName: "--surface-3" },
  { aliasName: "--color-surface-4", tokenName: "--surface-4" },
  { aliasName: "--color-surface-selected", tokenName: "--surface-selected" },
] as const;

const THEME_SCOPE_MATRIX = [
  {
    name: "light",
    selector: ":root",
    requiredTokens: REQUIRED_SEMANTIC_TONE_TOKENS,
  },
  {
    name: "dark",
    selector: ":root.dark",
    requiredTokens: REQUIRED_SEMANTIC_TONE_TOKENS,
  },
] as const;

const declarationNamePattern = /^\s*(--[\w-]+)\s*:/gm;
const themeAliasPattern = /^\s*(--color-[\w-]+)\s*:\s*var\((--[\w-]+)\)\s*;/gm;

function getRuleBlock(css: string, selector: string) {
  const escapedSelector = selector.replace(".", "\\.");
  const match = css.match(new RegExp(`${escapedSelector}\\s*\\{[\\s\\S]*?\\n\\}`));

  expect(match, `${selector} block should exist`).not.toBeNull();

  return match?.[0] ?? "";
}

function getDeclarationNames(block: string) {
  return new Set([...block.matchAll(declarationNamePattern)].map((match) => match[1]));
}

function getThemeColorAliasTokenNames(themeBlock: string) {
  return [...themeBlock.matchAll(themeAliasPattern)].map((match) => ({
    aliasName: match[1],
    tokenName: match[2],
  }));
}

describe("semantic tone tokens", () => {
  it("defines unread and starred tone tokens for both light and dark themes", () => {
    const css = readFileSync(GLOBAL_CSS_PATH, "utf-8");

    for (const themeScope of THEME_SCOPE_MATRIX) {
      const declarations = getDeclarationNames(getRuleBlock(css, themeScope.selector));

      expect([...declarations], `${themeScope.name} theme should define semantic tone tokens`).toEqual(
        expect.arrayContaining([...themeScope.requiredTokens]),
      );
    }
  });

  it("keeps empty-slot motion from hiding filled unread indicators", () => {
    const css = readFileSync(GLOBAL_CSS_PATH, "utf-8");

    expect(css).toContain('.motion-article-state-slot[data-article-state-slot="reserved"]:empty');
    expect(css).not.toContain(".motion-article-state-slot:empty {");
  });

  it("keeps article selection marker motion on compositor-friendly properties", () => {
    const css = readFileSync(GLOBAL_CSS_PATH, "utf-8");
    const markerKeyframes = css.match(/@keyframes motion-article-selection-marker\s*\{[\s\S]*?\n\}/)?.[0] ?? "";

    expect(markerKeyframes).toContain("opacity: 0");
    expect(markerKeyframes).toContain("transform: scaleY(0.72)");
    expect(css).toContain("transform: scaleY(1)");
    expect(markerKeyframes).not.toContain("translateY");
    expect(css).not.toContain("--motion-article-selection-marker-offset");
    expect(css).not.toContain(".motion-article-selection-marker,\n.motion-article-selection-marker::after");
  });

  it("keeps @theme color aliases backed by both light and dark root tokens", () => {
    const css = readFileSync(GLOBAL_CSS_PATH, "utf-8");
    const themeColorAliases = getThemeColorAliasTokenNames(getRuleBlock(css, "@theme inline"));

    expect(themeColorAliases, "@theme inline should expose the required --color-* alias contract").toEqual([
      ...REQUIRED_THEME_COLOR_ALIASES,
    ]);

    for (const themeScope of THEME_SCOPE_MATRIX) {
      const declarations = getDeclarationNames(getRuleBlock(css, themeScope.selector));
      const missingTokens = REQUIRED_THEME_COLOR_ALIASES.filter(({ tokenName }) => !declarations.has(tokenName));

      expect(missingTokens, `${themeScope.name} theme should back every @theme --color-* alias`).toEqual([]);
    }
  });
});
