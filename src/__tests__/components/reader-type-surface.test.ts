import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();

const readerTypeSurfaceFiles = [
  "src/components/reader/article-list.types.ts",
  "src/components/reader/browser-view.types.ts",
  "src/components/reader/command-palette.types.ts",
  "src/components/reader/feed-tree.types.ts",
  "src/components/reader/sidebar-feed-section.types.ts",
  "src/components/reader/sidebar.types.ts",
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
  return [...source.matchAll(/^export type\s+([A-Z]\w*)/gm)].map(
    (match) => match[1],
  );
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

describe("reader type surface", () => {
  it("tracks the reader feature-local type split candidates", () => {
    expect(
      readerTypeSurfaceFiles.filter(
        (path) => !existsSync(join(repoRoot, path)),
      ),
    ).toEqual([]);
    expect(readerTypeSurfaceFiles).toEqual([...readerTypeSurfaceFiles].sort());
  });

  it("keeps exported reader type contracts externally referenced", () => {
    const searchFiles = [
      ...collectTypeScriptFiles(join(repoRoot, "src/components/reader")),
      ...collectTypeScriptFiles(join(repoRoot, "src/__tests__/components")),
      ...collectTypeScriptFiles(join(repoRoot, "src/__tests__/hooks")),
    ];

    const unusedExports = readerTypeSurfaceFiles.flatMap((surfaceFile) => {
      const exportedTypeNames = extractExportedTypeNames(
        readRepoFile(surfaceFile),
      );

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

    expect(unusedExports).toEqual([]);
  });
});
