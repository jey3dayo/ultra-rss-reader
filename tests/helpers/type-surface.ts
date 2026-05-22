import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, normalize, relative } from "node:path";

export type TypeSurfaceAllowlistEntry =
  | string
  | {
      readonly path: string;
      readonly intent: string;
      readonly followUpNote: string;
      readonly allowedRestrictedExports?: readonly string[];
    };

export type TypeSurfaceContract = {
  readonly label: string;
  readonly typeFileList: readonly TypeSurfaceAllowlistEntry[];
};

export type TypeSurfaceHelper = {
  readonly assertTypeFileList: (contract: TypeSurfaceContract) => void;
  readonly assertRemainingTypeSurfaceAllowlist: (contract: TypeSurfaceContract) => void;
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
      files.push(toPosixPath(relative(repoRoot, entryPath)));
    }
  }

  return files;
}

function toPosixPath(path: string) {
  return path.replaceAll("\\", "/");
}

type ExportedTypeName = {
  readonly name: string;
  readonly sourcePath?: string;
};

function resolveTypeScriptModulePath(surfaceFile: string, modulePath: string): string {
  const basePath = toPosixPath(normalize(join(dirname(surfaceFile), modulePath)));

  return basePath.endsWith(".ts") || basePath.endsWith(".tsx") ? basePath : `${basePath}.ts`;
}

function extractExportedTypeNames(surfaceFile: string, source: string): ExportedTypeName[] {
  const exportedDeclarations = [...source.matchAll(/^export\s+(?:type|interface)\s+([A-Z]\w*)/gm)].map((match) => ({
    name: match[1] ?? "",
  }));
  const reExportedTypes = [
    ...source.matchAll(/^export\s+(?:type\s+)?\{([^}]+)\}(?:\s+from\s+["']([^"']+)["'])?/gm),
  ].flatMap((match) =>
    (match[1] ?? "")
      .split(",")
      .map((specifier): ExportedTypeName | null => {
        const typeName = specifier
          .trim()
          .replace(/^type\s+/, "")
          .match(/^([A-Z]\w*)\b/)?.[1];
        const modulePath = match[2];

        return typeName === undefined
          ? null
          : {
              name: typeName,
              sourcePath: modulePath === undefined ? undefined : resolveTypeScriptModulePath(surfaceFile, modulePath),
            };
      })
      .filter((typeName): typeName is ExportedTypeName => typeName !== null),
  );

  return [...exportedDeclarations, ...reExportedTypes].filter(({ name }) => name.length > 0);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getTypeFilePath(entry: TypeSurfaceAllowlistEntry) {
  return typeof entry === "string" ? entry : entry.path;
}

function getRestrictedExportNames(surfaceFile: string, source: string) {
  return extractExportedTypeNames(surfaceFile, source)
    .map(({ name }) => name)
    .filter((name) => /(Props|Params|Result)$/.test(name))
    .toSorted();
}

export function createTypeSurfaceHelper({
  expect,
  repoRoot,
  searchDirectories,
}: {
  expect: (
    actual: unknown,
    message?: string,
  ) => {
    toBe: (expected: unknown) => void;
    toEqual: (expected: unknown) => void;
  };
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
      const typeFilePaths = typeFileList.map(getTypeFilePath);

      expect(typeFilePaths.filter((path) => !existsSync(join(repoRoot, path)))).toEqual([]);
      expect(typeFilePaths).toEqual([...typeFilePaths].toSorted());
    },
    assertRemainingTypeSurfaceAllowlist({ typeFileList }: TypeSurfaceContract) {
      const remainingTypeSurfaceFiles = typeSurfaceSearchFiles.filter((path) => path.endsWith(".types.ts")).toSorted();
      const typeFilePaths = typeFileList.map(getTypeFilePath);

      expect(typeFileList.every((entry) => typeof entry !== "string")).toBe(true);
      expect(typeFilePaths.filter((path) => !existsSync(join(repoRoot, path)))).toEqual([]);
      expect(typeFilePaths).toEqual(remainingTypeSurfaceFiles);

      for (const entry of typeFileList) {
        if (typeof entry === "string") {
          continue;
        }

        expect(
          entry.intent.trim().length > 0,
          `${entry.path} should document why the type surface is intentional`,
        ).toBe(true);
        expect(
          entry.followUpNote.trim().length > 0,
          `${entry.path} should keep the cleanup follow-up note visible`,
        ).toBe(true);
        expect(getRestrictedExportNames(entry.path, readCachedRepoFile(entry.path)), entry.path).toEqual(
          [...(entry.allowedRestrictedExports ?? [])].toSorted(),
        );
      }
    },
    collectPublicContractDiagnostics({ label, typeFileList }: TypeSurfaceContract) {
      const diagnostics: string[] = [];

      for (const surfaceFile of typeFileList.map(getTypeFilePath)) {
        const exportedTypeNames = extractExportedTypeNames(surfaceFile, readCachedRepoFile(surfaceFile));

        for (const { name: typeName, sourcePath } of exportedTypeNames) {
          const typeNamePattern = new RegExp(`\\b${escapeRegExp(typeName)}\\b`);
          const hasExternalReference = typeSurfaceSearchFiles.some((candidateFile) => {
            if (candidateFile === surfaceFile || candidateFile === sourcePath) {
              return false;
            }

            return typeNamePattern.test(readCachedRepoFile(candidateFile));
          });

          if (!hasExternalReference) {
            diagnostics.push(
              `${surfaceFile}:${typeName} should stay in ${label} or move out of the public type surface`,
            );
          }
        }
      }

      return diagnostics.toSorted();
    },
  };
}
