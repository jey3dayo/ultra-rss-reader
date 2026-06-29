import { globSync, readFileSync } from "node:fs";
import { dirname, normalize, resolve, sep } from "node:path";
import { describe, expect, it } from "vitest";

const directBaseUiImportPattern = /@base-ui\/react\//;
const importSpecifierPattern =
  /(?:import|export)(?:\s+type)?[\s\S]*?\sfrom\s+["']([^"']+)["']|import\(["']([^"']+)["']\)/g;

const allowedImplementationRoots = [
  ["src", "components", "ui"].join(sep),
  ["src", "components", "shared"].join(sep),
  ["src", "design-system"].join(sep),
];
const allowedDirectBaseUiImportFiles = new Set([
  ["src", "__tests__", "components", "tooltip.test.tsx"].join(sep),
  ["src", "__tests__", "components", "ui-wrapper-public-api.node.test.ts"].join(sep),
]);
const allowedDirectStoryImportFiles = new Set([
  ["src", "__tests__", "components", "indeterminate-progress-stories.test.tsx"].join(sep),
  ["src", "__tests__", "components", "shared-stories.test.tsx"].join(sep),
  ["src", "__tests__", "components", "storybook-decorator-runtime-provider-parity.test.tsx"].join(sep),
]);
const allowedDirectCommandPrimitiveImportFiles = new Set([
  ["src", "__tests__", "components", "command-palette-resource-groups.test.tsx"].join(sep),
  ["src", "__tests__", "components", "command.test.tsx"].join(sep),
  ["src", "__tests__", "components", "design-ui-primitives.test.tsx"].join(sep),
  ["src", "components", "reader", "command-palette-action-groups.tsx"].join(sep),
  ["src", "components", "reader", "command-palette-resource-groups.tsx"].join(sep),
  ["src", "components", "reader", "command-palette-results.tsx"].join(sep),
  ["src", "components", "reader", "command-palette.tsx"].join(sep),
  ["src", "components", "reader", "shortcuts-help-modal.tsx"].join(sep),
  ["src", "components", "storybook", "ui-reference-shell-specimens.tsx"].join(sep),
]);

const sourceFiles = globSync("{src,tests,e2e,.storybook}/**/*.{ts,tsx}", {
  cwd: process.cwd(),
})
  .map((path) => path.split("/").join(sep))
  .filter((path) => !allowedImplementationRoots.some((root) => path.startsWith(root + sep)))
  .filter((path) => !path.endsWith(["components", "design-system-import-boundary.node.test.ts"].join(sep)));
const implementationFiles = globSync("{src/components/ui,src/components/shared}/**/*.{ts,tsx}", {
  cwd: process.cwd(),
}).map((path) => path.split("/").join(sep));

describe("design system import boundary", () => {
  it("keeps heavy menu primitives out of the startup public barrel", () => {
    const publicBarrel = readFileSync(["src", "design-system", "index.ts"].join(sep), "utf8");

    expect(publicBarrel).not.toContain("@base-ui/react/context-menu");
    expect(publicBarrel).not.toContain("@base-ui/react/menu");
  });

  it("routes app, feature, storybook, and test UI imports through the design-system public API", () => {
    const offenders = sourceFiles.flatMap((path) =>
      getImportSpecifiers(path)
        .filter((specifier) => isDirectDesignImplementationImport(path, specifier))
        .map((specifier) => `${path}: ${specifier}`),
    );

    expect(offenders).toEqual([]);
  });

  it("keeps headless UI primitive imports behind the design-system implementation layer", () => {
    const offenders = sourceFiles
      .filter((path) => !allowedDirectBaseUiImportFiles.has(path))
      .filter((path) => {
        const source = readFileSync(path, "utf8");
        return directBaseUiImportPattern.test(source);
      });

    expect(offenders).toEqual([]);
  });

  it("keeps implementation components independent from the design-system public barrel", () => {
    const offenders = implementationFiles.flatMap((path) =>
      getImportSpecifiers(path)
        .filter((specifier) => specifier === "@/design-system")
        .map((specifier) => `${path}: ${specifier}`),
    );

    expect(offenders).toEqual([]);
  });
});

function getImportSpecifiers(path: string): string[] {
  const source = readFileSync(path, "utf8");
  return Array.from(source.matchAll(importSpecifierPattern), (match) => match[1] ?? match[2]).filter(
    (specifier): specifier is string => Boolean(specifier),
  );
}

function isDirectDesignImplementationImport(importerPath: string, specifier: string): boolean {
  if (isAllowedStoryImport(importerPath, specifier)) {
    return false;
  }

  if (allowedDirectCommandPrimitiveImportFiles.has(importerPath) && specifier === "@/components/ui/command") {
    return false;
  }

  if (specifier.startsWith("@/components/ui/") || specifier.startsWith("@/components/shared/")) {
    return true;
  }

  if (!specifier.startsWith(".")) {
    return false;
  }

  const resolvedImportPath = normalize(resolve(process.cwd(), dirname(importerPath), specifier));
  const uiRoot = normalize(resolve(process.cwd(), "src", "components", "ui")) + sep;
  const sharedRoot = normalize(resolve(process.cwd(), "src", "components", "shared")) + sep;
  return resolvedImportPath.startsWith(uiRoot) || resolvedImportPath.startsWith(sharedRoot);
}

function isAllowedStoryImport(importerPath: string, specifier: string): boolean {
  return allowedDirectStoryImportFiles.has(importerPath) && specifier.includes(".stories");
}
