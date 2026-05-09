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

const THEME_SCOPE_MATRIX = [
  {
    name: "light",
    selector: ":root",
  },
  {
    name: "dark",
    selector: ":root.dark",
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

      const requiredSemanticToneTokens = [...REQUIRED_SEMANTIC_TONE_TOKENS];

      expect([...declarations], `${themeScope.name} theme should define semantic tone tokens`).toEqual(
        expect.arrayContaining(requiredSemanticToneTokens),
      );
    }
  });

  it("keeps @theme color aliases backed by both light and dark root tokens", () => {
    const css = readFileSync(GLOBAL_CSS_PATH, "utf-8");
    const themeColorAliases = getThemeColorAliasTokenNames(getRuleBlock(css, "@theme inline"));

    expect(themeColorAliases.length).toBeGreaterThan(0);

    for (const themeScope of THEME_SCOPE_MATRIX) {
      const declarations = getDeclarationNames(getRuleBlock(css, themeScope.selector));
      const missingAliases = themeColorAliases.filter(({ tokenName }) => !declarations.has(tokenName));

      expect(missingAliases, `${themeScope.name} theme should back every @theme --color-* alias`).toEqual([]);
    }
  });
});
