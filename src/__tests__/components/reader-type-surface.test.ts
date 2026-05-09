import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();

const readerTypeSurfaceFiles = [
  "src/components/reader/add-feed-dialog.types.ts",
  "src/components/reader/article-actions.types.ts",
  "src/components/reader/article-list.types.ts",
  "src/components/reader/browser-view.types.ts",
  "src/components/reader/command-palette.types.ts",
  "src/components/reader/feed-tree.types.ts",
  "src/components/reader/rename-feed-dialog.types.ts",
  "src/components/reader/sidebar-feed-section.types.ts",
  "src/components/reader/sidebar-runtime.types.ts",
  "src/components/reader/sidebar-sources.types.ts",
  "src/components/reader/sidebar.types.ts",
] as const;

const settingsTypeSurfaceFiles = [
  "src/components/settings/settings-modal.types.ts",
  "src/components/settings/settings-nav.types.ts",
  "src/components/settings/settings-page.types.ts",
] as const;

const localOnlyTypeSurfaceFiles = [
  "src/components/reader/article-actions.types.ts",
  "src/components/reader/sidebar-runtime.types.ts",
  "src/components/reader/sidebar-sources.types.ts",
  "src/components/settings/add-account/form-view.types.ts",
] as const;

const cleanupContractTestFiles = {
  semanticTokenAndRoleContracts: [
    "src/__tests__/components/article-filter-toggle-button.test.ts",
    "src/__tests__/components/article-list-context-strip.test.tsx",
    "src/__tests__/components/article-list-footer.test.tsx",
    "src/__tests__/components/article-list-item.test.tsx",
    "src/__tests__/components/surface-card.test.tsx",
  ],
  readerPureHelperContracts: [
    "src/__tests__/components/article-list-item.test.tsx",
    "src/__tests__/components/feed-mark-all-read.test.ts",
    "src/__tests__/components/use-article-list-navigation.test.tsx",
  ],
  publicWrapperSurfaceContracts: ["src/__tests__/components/ui-wrapper-public-api.test.ts"],
} as const;

const typeSurfaceSearchDirectories = [
  "src/components/reader",
  "src/components/settings",
  "src/__tests__/components",
  "src/__tests__/hooks",
] as const;

function collectTypeScriptFiles(directoryPath: string): string[] {
  if (!existsSync(directoryPath)) {
    return [];
  }

  const entries = readdirSync(directoryPath, { withFileTypes: true });

  return entries.flatMap((entry) => {
    const entryPath = join(directoryPath, entry.name);

    if (entry.isDirectory()) {
      return collectTypeScriptFiles(entryPath);
    }

    if (!entry.name.endsWith(".ts") && !entry.name.endsWith(".tsx")) {
      return [];
    }

    return [relative(repoRoot, entryPath)];
  });
}

function readRepoFile(path: string) {
  return readFileSync(join(repoRoot, path), "utf8");
}

function extractExportedTypeNames(source: string) {
  return [...source.matchAll(/^export type\s+([A-Z]\w*)/gm)].map((match) => match[1]);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function collectTypeSurfaceSearchFiles() {
  return typeSurfaceSearchDirectories.flatMap((directoryPath) => collectTypeScriptFiles(join(repoRoot, directoryPath)));
}

function collectUnusedExports(surfaceFiles: readonly string[], searchFiles = collectTypeSurfaceSearchFiles()) {
  return surfaceFiles.flatMap((surfaceFile) => {
    const exportedTypeNames = extractExportedTypeNames(readRepoFile(surfaceFile));

    return exportedTypeNames
      .filter((typeName) => {
        const typeNamePattern = new RegExp(`\\b${escapeRegExp(typeName)}\\b`);

        return !searchFiles.some((candidateFile) => {
          if (candidateFile === surfaceFile) {
            return false;
          }

          return typeNamePattern.test(readRepoFile(candidateFile));
        });
      })
      .map((typeName) => `${surfaceFile}:${typeName}`);
  });
}

describe("reader type surface", () => {
  it("tracks the reader feature-local type split candidates", () => {
    expect(readerTypeSurfaceFiles.filter((path) => !existsSync(join(repoRoot, path)))).toEqual([]);
    expect(readerTypeSurfaceFiles).toEqual([...readerTypeSurfaceFiles].sort());
  });

  it("keeps exported reader type contracts externally referenced", () => {
    expect(collectUnusedExports(readerTypeSurfaceFiles)).toEqual([]);
  });

  it("tracks settings feature-local type split candidates", () => {
    expect(settingsTypeSurfaceFiles.filter((path) => !existsSync(join(repoRoot, path)))).toEqual([]);
    expect(settingsTypeSurfaceFiles).toEqual([...settingsTypeSurfaceFiles].sort());
  });

  it("keeps exported settings type contracts externally referenced", () => {
    expect(collectUnusedExports(settingsTypeSurfaceFiles)).toEqual([]);
  });

  it("tracks local-only exported Props/Params/Result cleanup candidates", () => {
    expect(localOnlyTypeSurfaceFiles.filter((path) => !existsSync(join(repoRoot, path)))).toEqual([]);
    expect(localOnlyTypeSurfaceFiles).toEqual([...localOnlyTypeSurfaceFiles].sort());
  });

  it("keeps local-only exported type contracts externally referenced", () => {
    expect(collectUnusedExports(localOnlyTypeSurfaceFiles)).toEqual([]);
  });

  it("tracks small cleanup contracts without adding broad visual snapshots", () => {
    const contractTestFiles = Object.values(cleanupContractTestFiles).flat();

    expect(contractTestFiles.filter((path) => !existsSync(join(repoRoot, path)))).toEqual([]);

    for (const contractTestFile of contractTestFiles) {
      const source = readRepoFile(contractTestFile);

      expect(source, `${contractTestFile} should avoid snapshot-based visual coverage`).not.toContain(
        "toMatchSnapshot",
      );
      expect(source, `${contractTestFile} should stay focused on contract assertions`).toMatch(
        /toHaveAttribute|toHaveClass|expectTypeOf|toEqual|toContain|toBe|toHaveBeenCalledWith/,
      );
    }
  });
});
