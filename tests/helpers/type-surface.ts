import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

export type TypeSurfaceContract = {
  readonly label: string;
  readonly typeFileList: readonly string[];
};

export type TypeSurfaceHelper = {
  readonly assertTypeFileList: (contract: TypeSurfaceContract) => void;
  readonly collectPublicContractDiagnostics: (contract: TypeSurfaceContract) => string[];
};

function collectTypeScriptFiles(repoRoot: string, directoryPath: string): string[] {
  if (!existsSync(directoryPath)) {
    return [];
  }

  const files: string[] = [];
  const entries = readdirSync(directoryPath, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = join(directoryPath, entry.name);

    if (entry.isDirectory()) {
      files.push(...collectTypeScriptFiles(repoRoot, entryPath));
    } else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) {
      files.push(relative(repoRoot, entryPath));
    }
  }

  return files;
}

function extractExportedTypeNames(source: string) {
  return [...source.matchAll(/^export type\s+([A-Z]\w*)/gm)].map((match) => match[1]);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function createTypeSurfaceHelper({
  expect,
  repoRoot,
  searchDirectories,
}: {
  expect: (actual: unknown, message?: string) => { toEqual: (expected: unknown) => void };
  repoRoot: string;
  searchDirectories: readonly string[];
}): TypeSurfaceHelper {
  const typeSurfaceSearchFiles = searchDirectories.flatMap((directoryPath) =>
    collectTypeScriptFiles(repoRoot, join(repoRoot, directoryPath)),
  );
  const sourceByPath = new Map<string, string>();

  function readCachedRepoFile(path: string) {
    const cachedSource = sourceByPath.get(path);

    if (cachedSource !== undefined) {
      return cachedSource;
    }

    const source = readFileSync(join(repoRoot, path), "utf8");

    sourceByPath.set(path, source);

    return source;
  }

  return {
    assertTypeFileList({ typeFileList }: TypeSurfaceContract) {
      expect(typeFileList.filter((path) => !existsSync(join(repoRoot, path)))).toEqual([]);
      expect(typeFileList).toEqual([...typeFileList].sort());
    },
    collectPublicContractDiagnostics({ label, typeFileList }: TypeSurfaceContract) {
      const diagnostics: string[] = [];

      for (const surfaceFile of typeFileList) {
        const exportedTypeNames = extractExportedTypeNames(readCachedRepoFile(surfaceFile));

        for (const typeName of exportedTypeNames) {
          const typeNamePattern = new RegExp(`\\b${escapeRegExp(typeName)}\\b`);
          const hasExternalReference = typeSurfaceSearchFiles.some((candidateFile) => {
            if (candidateFile === surfaceFile) {
              return false;
            }

            return typeNamePattern.test(readCachedRepoFile(candidateFile));
          });

          if (!hasExternalReference) {
            diagnostics.push(`${surfaceFile}:${typeName} should stay in ${label} or move out of the public type surface`);
          }
        }
      }

      return diagnostics.sort();
    },
  };
}
