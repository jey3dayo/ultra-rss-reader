import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { UI_REFERENCE_PRIMARY_SPECIMEN_ANCHOR_IDS } from "@/components/storybook/ui-reference-control-specimens";

type UiReferenceSection = {
  fileName: string;
  sectionId: string;
  title: string;
};

const STORYBOOK_COMPONENTS_DIR = resolve(process.cwd(), "src/components/storybook");
const SPECIMENS_SOURCE_FILE_NAMES = [
  "ui-reference-canvas-specimens.tsx",
  "ui-reference-control-specimens.tsx",
  "ui-reference-foundation-specimens.tsx",
  "ui-reference-navigation-specimens.tsx",
  "ui-reference-settings-specimens.tsx",
  "ui-reference-shell-specimens.tsx",
  "ui-reference-workspace-specimens.tsx",
] as const;

const uiReferenceSections = [
  {
    fileName: "ui-reference-foundations-canvas.stories.tsx",
    sectionId: "foundations",
    title: "UI Reference/Foundations Canvas",
  },
  {
    fileName: "ui-reference-settings-canvas.stories.tsx",
    sectionId: "input-controls",
    title: "UI Reference/Input Controls Canvas",
  },
  {
    fileName: "ui-reference-button-controls-canvas.stories.tsx",
    sectionId: "button-controls",
    title: "UI Reference/Button Controls Canvas",
  },
  {
    fileName: "ui-reference-shell-overlay-canvas.stories.tsx",
    sectionId: "shell-overlay",
    title: "UI Reference/Shell & Overlay Canvas",
  },
  {
    fileName: "ui-reference-settings-workspace-canvas.stories.tsx",
    sectionId: "settings-workspace",
    title: "UI Reference/Settings Workspace Canvas",
  },
  {
    fileName: "ui-reference-navigation-collections-canvas.stories.tsx",
    sectionId: "navigation-collections",
    title: "UI Reference/Navigation & Collections Canvas",
  },
  {
    fileName: "ui-reference-workspace-patterns-canvas.stories.tsx",
    sectionId: "view-specimens",
    title: "UI Reference/View Specimens Canvas",
  },
] satisfies UiReferenceSection[];

const storySourceEntries = uiReferenceSections.map((section) => ({
  ...section,
  source: readFileSync(join(STORYBOOK_COMPONENTS_DIR, section.fileName), "utf8"),
}));
const specimensSource = SPECIMENS_SOURCE_FILE_NAMES.map((fileName) =>
  readFileSync(join(STORYBOOK_COMPONENTS_DIR, fileName), "utf8"),
).join("\n");

function findDuplicates(values: readonly string[]) {
  const counts = new Map<string, number>();
  const duplicates: string[] = [];

  for (const value of values) {
    const nextCount = (counts.get(value) ?? 0) + 1;
    counts.set(value, nextCount);

    if (nextCount === 2) {
      duplicates.push(value);
    }
  }

  return duplicates;
}

function extractReferenceTestIds(source: string) {
  return [...source.matchAll(/(?:data-testid|testId)=\{?"(reference-[^"]+)"\}?|testId:\s*"(reference-[^"]+)"/g)].map(
    (match) => match[1] ?? match[2] ?? "",
  );
}

function extractSpecimenExports(source: string) {
  return [...source.matchAll(/export function (\w+Specimen)\b/g)].map((match) => match[1] ?? "");
}

function extractReferencedSpecimens(source: string) {
  return [...source.matchAll(/<([A-Z]\w*Specimen)\b/g)].map((match) => match[1] ?? "");
}

describe("UI Reference specimen registry", () => {
  it("keeps UI Reference story sections explicitly registered without duplicate ids", () => {
    const sectionIds = uiReferenceSections.map((section) => section.sectionId);
    const storyFileNames = readdirSync(STORYBOOK_COMPONENTS_DIR)
      .filter((fileName) => /^ui-reference-.*\.stories\.tsx$/.test(fileName))
      .sort();

    expect(findDuplicates(sectionIds)).toEqual([]);
    expect(storyFileNames).toEqual(uiReferenceSections.map((section) => section.fileName).sort());
  });

  it("keeps registered section titles aligned with the Storybook meta titles", () => {
    const titleDrift = storySourceEntries.flatMap(({ fileName, source, title }) => {
      return source.includes(`title: "${title}"`) ? [] : `${fileName} should keep title "${title}"`;
    });

    expect(titleDrift).toEqual([]);
  });

  it("keeps reference specimen test ids unique across specimens and UI Reference stories", () => {
    const referenceIds = [
      ...extractReferenceTestIds(specimensSource),
      ...storySourceEntries.flatMap(({ source }) => extractReferenceTestIds(source)),
    ];

    expect(findDuplicates(referenceIds)).toEqual([]);
  });

  it("keeps primary specimen anchor candidates present and duplicate-safe", () => {
    const referenceIds = extractReferenceTestIds(specimensSource);

    expect(UI_REFERENCE_PRIMARY_SPECIMEN_ANCHOR_IDS).toEqual([...new Set(UI_REFERENCE_PRIMARY_SPECIMEN_ANCHOR_IDS)]);
    expect(referenceIds).toEqual(expect.arrayContaining([...UI_REFERENCE_PRIMARY_SPECIMEN_ANCHOR_IDS]));
  });

  it("keeps exported specimen sections referenced by a UI Reference story", () => {
    const exportedSpecimens = extractSpecimenExports(specimensSource).sort();
    const referencedSpecimens = [
      ...new Set(storySourceEntries.flatMap(({ source }) => extractReferencedSpecimens(source))),
    ].sort();

    expect(referencedSpecimens).toEqual(exportedSpecimens);
  });
});
