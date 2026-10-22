import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// settings-surface.ts sums paddings owned by other files into literal Tailwind classes (Tailwind
// only sees literal tokens, so they cannot be derived at runtime). Reading the sources from disk
// keeps those sums from drifting away from the paddings they mirror.

function readRepoFile(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

function captureNumber(source: string, pattern: RegExp, label: string): number {
  const match = pattern.exec(source);
  if (match?.[1] === undefined) {
    throw new Error(`Could not find ${label}`);
  }
  return Number(match[1]);
}

function rem(spacingUnits: number): string {
  return `${spacingUnits * 0.25}rem`;
}

describe("settings card inset contract", () => {
  const layout = readRepoFile("src/components/settings/shared/settings-content-layout.tsx");
  const section = readRepoFile("src/components/settings/shared/settings-section.tsx");
  const controlRow = readRepoFile("src/components/shared/labeled-control-row.tsx");
  const surface = readRepoFile("src/components/settings/shared/settings-surface.ts");

  const bodyBase = captureNumber(
    layout,
    /"p-(\d+(?:\.\d+)?) sm:p-\d+(?:\.\d+)?"/,
    "body padding in settings-content-layout",
  );
  const bodySm = captureNumber(
    layout,
    /"p-\d+(?:\.\d+)? sm:p-(\d+(?:\.\d+)?)"/,
    "body sm padding in settings-content-layout",
  );
  const sectionBase = captureNumber(
    section,
    /(?<![\w:-])px-(\d+(?:\.\d+)?)(?![\w-])/,
    "flat section px in settings-section",
  );
  const sectionSm = captureNumber(section, /sm:px-(\d+(?:\.\d+)?)(?![\w-])/, "flat section sm:px in settings-section");
  const railPadding = captureNumber(
    controlRow,
    /lg:pr-(\d+(?:\.\d+)?)(?![\w-])/,
    "control rail lg:pr in labeled-control-row",
  );

  it("keeps the flat section border at 1px, which the inset sums as 1px", () => {
    expect(section).toMatch(/"rounded-md border /);
  });

  const baseInset = `px-[calc(${rem(bodyBase)}+1px+${rem(sectionBase)})]`;
  const smInset = `sm:px-[calc(${rem(bodySm)}+1px+${rem(sectionSm)})]`;
  const lgTrailingInset = `lg:pr-[calc(${rem(bodySm)}+1px+${rem(sectionSm)}+${rem(railPadding)})]`;

  it("matches the content inset to body padding + card border + flat section padding", () => {
    expect(surface).toContain(`"${baseInset} ${smInset}"`);
  });

  it("matches the controls inset to the content inset + control rail padding", () => {
    expect(surface).toContain(`"${baseInset} ${smInset} ${lgTrailingInset}"`);
  });
});
