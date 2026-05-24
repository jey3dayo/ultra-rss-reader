import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { collectDuplicateRegistryValues, sortedRegistryValues } from "@tests/helpers/design-registry";
import { describe, expect, it } from "vitest";
import {
  UI_REFERENCE_DECORATIVE_TEST_IDS,
  UI_REFERENCE_PRIMARY_SPECIMEN_ANCHOR_IDS,
} from "@/components/storybook/ui-reference-canvas-specimen-ids";

type UiReferenceSection = {
  fileName: string;
  sectionId: string;
  title: string;
  specimenSourceFileName: (typeof CATEGORY_SPECIMENS_SOURCE_FILE_NAMES)[number];
};

const STORYBOOK_COMPONENTS_DIR = resolve(process.cwd(), "src/components/storybook");
const GLOBAL_CSS_SOURCE = readFileSync(resolve(process.cwd(), "src/styles/global.css"), "utf8");
const SPECIMENS_SOURCE_FILE_NAMES = [
  "ui-reference-canvas-specimens.tsx",
  "ui-reference-control-specimens.tsx",
  "ui-reference-foundation-specimens.tsx",
  "ui-reference-navigation-specimens.tsx",
  "ui-reference-settings-specimens.tsx",
  "ui-reference-shell-specimens.tsx",
  "ui-reference-workspace-specimens.tsx",
] as const;
const CATEGORY_SPECIMENS_SOURCE_FILE_NAMES = SPECIMENS_SOURCE_FILE_NAMES.filter(
  (fileName) => fileName !== "ui-reference-canvas-specimens.tsx",
);

const uiReferenceSections = [
  {
    fileName: "ui-reference-foundations-canvas.stories.tsx",
    sectionId: "foundations",
    specimenSourceFileName: "ui-reference-foundation-specimens.tsx",
    title: "UI Reference/Foundations Canvas",
  },
  {
    fileName: "ui-reference-settings-canvas.stories.tsx",
    sectionId: "input-controls",
    specimenSourceFileName: "ui-reference-settings-specimens.tsx",
    title: "UI Reference/Input Controls Canvas",
  },
  {
    fileName: "ui-reference-button-controls-canvas.stories.tsx",
    sectionId: "button-controls",
    specimenSourceFileName: "ui-reference-control-specimens.tsx",
    title: "UI Reference/Button Controls Canvas",
  },
  {
    fileName: "ui-reference-shell-overlay-canvas.stories.tsx",
    sectionId: "shell-overlay",
    specimenSourceFileName: "ui-reference-shell-specimens.tsx",
    title: "UI Reference/Shell & Overlay Canvas",
  },
  {
    fileName: "ui-reference-settings-workspace-canvas.stories.tsx",
    sectionId: "settings-workspace",
    specimenSourceFileName: "ui-reference-settings-specimens.tsx",
    title: "UI Reference/Settings Workspace Canvas",
  },
  {
    fileName: "ui-reference-navigation-collections-canvas.stories.tsx",
    sectionId: "navigation-collections",
    specimenSourceFileName: "ui-reference-navigation-specimens.tsx",
    title: "UI Reference/Navigation & Collections Canvas",
  },
  {
    fileName: "ui-reference-workspace-patterns-canvas.stories.tsx",
    sectionId: "view-specimens",
    specimenSourceFileName: "ui-reference-workspace-specimens.tsx",
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
const uiReferenceSource = [specimensSource, ...storySourceEntries.map(({ source }) => source)].join("\n");

const requiredReferenceTokenCoverage = [
  {
    token: "--surface-1",
    specimenSource: "ui-reference-foundation-specimens.tsx",
    sourceSnippet: "bg-surface-1/88",
  },
  {
    token: "--surface-2",
    specimenSource: "ui-reference-foundation-specimens.tsx",
    sourceSnippet: '<SurfaceCard variant="section">',
  },
  {
    token: "--surface-3",
    specimenSource: "ui-reference-settings-specimens.tsx",
    sourceSnippet: "bg-surface-3",
  },
  {
    token: "--surface-4",
    specimenSource: "ui-reference-foundation-specimens.tsx",
    sourceSnippet: "border-surface-4",
  },
  {
    token: "--surface-selected",
    specimenSource: "ui-reference-foundation-specimens.tsx",
    sourceSnippet: "bg-[var(--surface-selected)]",
  },
  {
    token: "--state-success-surface",
    specimenSource: "ui-reference-foundation-specimens.tsx",
    sourceSnippet: "bg-state-success-surface",
  },
  {
    token: "--state-warning-surface",
    specimenSource: "ui-reference-foundation-specimens.tsx",
    sourceSnippet: "bg-state-warning-surface",
  },
  {
    token: "--state-review-surface",
    specimenSource: "ui-reference-foundation-specimens.tsx",
    sourceSnippet: "bg-state-review-surface",
  },
  {
    token: "--state-danger-surface",
    specimenSource: "ui-reference-foundation-specimens.tsx",
    sourceSnippet: "bg-state-danger-surface",
  },
  {
    token: "--semantic-tone-unread-surface",
    specimenSource: "ui-reference-control-specimens.tsx",
    sourceSnippet: '"--semantic-tone-unread-surface"',
  },
  {
    token: "--semantic-tone-starred-surface",
    specimenSource: "ui-reference-shell-specimens.tsx",
    sourceSnippet: "var(--semantic-tone-starred-surface)",
  },
] as const;

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function countCssTokenDefinitions(source: string, token: string) {
  return [...source.matchAll(new RegExp(`${escapeRegExp(token)}\\s*:`, "g"))].length;
}

function countValues(values: readonly string[]) {
  return values.reduce<Record<string, number>>((counts, value) => {
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
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

function extractStorybookImportSourceFileNames(source: string) {
  return [
    ...source.matchAll(
      /from\s+"@\/components\/storybook\/(ui-reference-(?:canvas|control|foundation|navigation|settings|shell|workspace)-specimens)"/g,
    ),
  ].map((match) => `${match[1]}.tsx`);
}

function extractCategorySpecimenExports() {
  const exportNames: string[] = [];
  const emptyExportFiles: { fileName: string; exports: string[] }[] = [];

  for (const fileName of CATEGORY_SPECIMENS_SOURCE_FILE_NAMES) {
    const exports = extractSpecimenExports(readFileSync(join(STORYBOOK_COMPONENTS_DIR, fileName), "utf8"));

    exportNames.push(...exports);

    if (exports.length === 0) {
      emptyExportFiles.push({ fileName, exports });
    }
  }

  return { emptyExportFiles, exportNames };
}

describe("UI Reference specimen registry", () => {
  it("keeps UI Reference story sections explicitly registered without duplicate ids", () => {
    const sectionIds = uiReferenceSections.map((section) => section.sectionId);
    const storyFileNames = sortedRegistryValues(
      readdirSync(STORYBOOK_COMPONENTS_DIR).filter((fileName) => /^ui-reference-.*\.stories\.tsx$/.test(fileName)),
    );

    expect(collectDuplicateRegistryValues(sectionIds)).toEqual([]);
    expect(storyFileNames).toEqual(sortedRegistryValues(uiReferenceSections.map((section) => section.fileName)));
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

    expect(collectDuplicateRegistryValues(referenceIds)).toEqual([]);
  });

  it("classifies every reference specimen test id as a smoke anchor or decorative id", () => {
    const referenceIds = extractReferenceTestIds(uiReferenceSource);
    const classifiedReferenceIds = [...UI_REFERENCE_PRIMARY_SPECIMEN_ANCHOR_IDS, ...UI_REFERENCE_DECORATIVE_TEST_IDS];

    expect(UI_REFERENCE_PRIMARY_SPECIMEN_ANCHOR_IDS).toEqual([...new Set(UI_REFERENCE_PRIMARY_SPECIMEN_ANCHOR_IDS)]);
    expect(UI_REFERENCE_DECORATIVE_TEST_IDS).toEqual([...new Set(UI_REFERENCE_DECORATIVE_TEST_IDS)]);
    expect(sortedRegistryValues(classifiedReferenceIds)).toEqual(
      sortedRegistryValues([...new Set(classifiedReferenceIds)]),
    );
    expect(sortedRegistryValues(classifiedReferenceIds)).toEqual(sortedRegistryValues([...new Set(referenceIds)]));
  });

  it("keeps primary specimen smoke anchors present exactly once", () => {
    const referenceIdCounts = countValues(extractReferenceTestIds(uiReferenceSource));
    const missingAnchors = UI_REFERENCE_PRIMARY_SPECIMEN_ANCHOR_IDS.filter((anchorId) => !referenceIdCounts[anchorId]);
    const duplicateAnchors = UI_REFERENCE_PRIMARY_SPECIMEN_ANCHOR_IDS.filter(
      (anchorId) => referenceIdCounts[anchorId] > 1,
    );

    expect(missingAnchors).toEqual([]);
    expect(duplicateAnchors).toEqual([]);
  });

  it("keeps exported specimen sections referenced by a UI Reference story", () => {
    const exportedSpecimens = sortedRegistryValues(extractSpecimenExports(specimensSource));
    const referencedSpecimens = sortedRegistryValues([
      ...new Set(storySourceEntries.flatMap(({ source }) => extractReferencedSpecimens(source))),
    ]);

    expect(referencedSpecimens).toEqual(exportedSpecimens);
  });

  it("keeps UI Reference specimen ownership in category files", () => {
    const canvasSpecimensSource = readFileSync(
      join(STORYBOOK_COMPONENTS_DIR, "ui-reference-canvas-specimens.tsx"),
      "utf8",
    );
    const categorySpecimenExports = extractCategorySpecimenExports();

    expect(extractSpecimenExports(canvasSpecimensSource)).toEqual([]);
    expect(sortedRegistryValues(categorySpecimenExports.exportNames)).toEqual(
      sortedRegistryValues(extractSpecimenExports(specimensSource)),
    );
    expect(categorySpecimenExports.emptyExportFiles).toEqual([]);
  });

  it("keeps UI Reference story imports pointed at the owning category specimen file", () => {
    const importDrift = storySourceEntries.flatMap(({ fileName, source, specimenSourceFileName }) => {
      const importSourceFileNames = extractStorybookImportSourceFileNames(source);

      return importSourceFileNames.length === 1 && importSourceFileNames[0] === specimenSourceFileName
        ? []
        : `${fileName} should import specimens from ${specimenSourceFileName}`;
    });

    expect(importDrift).toEqual([]);
  });

  it("keeps required CSS tokens represented by Storybook reference specimens", () => {
    const missingCoverage = requiredReferenceTokenCoverage.flatMap(({ token, specimenSource, sourceSnippet }) => {
      const source = readFileSync(join(STORYBOOK_COMPONENTS_DIR, specimenSource), "utf8");
      const tokenDefinitionCount = countCssTokenDefinitions(GLOBAL_CSS_SOURCE, token);

      return tokenDefinitionCount >= 2 && source.includes(sourceSnippet)
        ? []
        : `${token} should stay defined for light/dark themes and covered by ${specimenSource}`;
    });

    expect(missingCoverage).toEqual([]);
  });
});
