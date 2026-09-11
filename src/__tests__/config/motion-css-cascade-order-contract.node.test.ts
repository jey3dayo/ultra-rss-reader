import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Structural regression guard for the global.css -> motion.css extraction.
// motion.css's rules must keep winning the cascade the same way they did as
// the tail of global.css: they are plain (unlayered) CSS that has to be the
// LAST unlayered CSS the app loads, so they keep beating earlier unlayered
// rules and Tailwind's layered utilities. Three ways to break that, each
// guarded below:
// - importing motion.css before global.css in an entry point (order reversal)
// - wrapping motion.css in `@layer` (layered CSS always loses to unlayered
//   CSS, so a layered motion.css would silently stop overriding utilities)
// - importing motion.css via `@import` inside global.css itself (a CSS
//   `@import` must sit at the top of the file, which would move motion rules
//   from "last" to "first" and flip who wins on equal specificity)
//
// These read from disk rather than through a `?raw` import: the Vite CSS
// pipeline rewrites what `?raw` yields for a stylesheet, and an injected
// `@layer` at-rule did not survive into the imported string, so the guard
// below passed against a genuinely layered file. Reading the bytes is what
// gives this contract any detection power.

function readRepoFile(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

/** Strips CSS comments so prose mentioning an at-rule cannot stand in for one. */
function stripCssComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "");
}

const mainTsxSource = readRepoFile("src/main.tsx");
const previewSource = readRepoFile(".storybook/preview.ts");
const globalCssSource = readRepoFile("src/styles/global.css");
const motionCssSource = readRepoFile("src/styles/motion.css");

function assertImportOrder(source: string, label: string) {
  const globalCssImportIndex = source.indexOf("styles/global.css");
  const motionCssImportIndex = source.indexOf("styles/motion.css");

  expect(globalCssImportIndex, `${label} should import global.css`).toBeGreaterThanOrEqual(0);
  expect(motionCssImportIndex, `${label} should import motion.css`).toBeGreaterThanOrEqual(0);
  expect(motionCssImportIndex, `${label} must import motion.css after global.css`).toBeGreaterThan(
    globalCssImportIndex,
  );
}

describe("motion.css cascade order contract", () => {
  it("imports motion.css after global.css in the app entry point", () => {
    assertImportOrder(mainTsxSource, "src/main.tsx");
  });

  it("imports motion.css after global.css in the Storybook preview", () => {
    assertImportOrder(previewSource, ".storybook/preview.ts");
  });

  it("keeps motion.css unlayered so it still wins over Tailwind's layered utilities", () => {
    expect(stripCssComments(motionCssSource)).not.toMatch(/@layer\b/);
  });

  it("does not re-import motion.css from inside global.css", () => {
    expect(stripCssComments(globalCssSource)).not.toMatch(/@import\s+["']\.\/motion\.css["']/);
  });
});
