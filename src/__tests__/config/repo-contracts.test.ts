import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, normalize, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import storybookConfig from "../../../.storybook/main";
import packageJson from "../../../package.json";
import tauriConfig from "../../../src-tauri/tauri.conf.json";
import tauriReleaseConfig from "../../../src-tauri/tauri.release.conf.json";

const repoRoot = process.cwd();

function readRepoFile(path: string) {
  return readFileSync(join(repoRoot, path), "utf8");
}

function extractMiseTaskNames(source: string) {
  const taskNames = new Set<string>();

  for (const match of source.matchAll(/^\[tasks(?:\."([^"]+)"|\.([^\]\s]+))\]/gm)) {
    taskNames.add(match[1] ?? match[2]);
  }

  return taskNames;
}

function extractMiseRunTasks(source: string) {
  return [...source.matchAll(/\bmise\s+run\s+([A-Za-z0-9:_-]+)/g)].map((match) => match[1]);
}

function extractCargoPackageVersion(source: string) {
  const packageStart = source.indexOf("[package]");
  const nextSection = source.indexOf("\n[", packageStart + "[package]".length);
  const packageSection = source.slice(packageStart, nextSection === -1 ? undefined : nextSection);
  return packageSection.match(/^version\s*=\s*"([^"]+)"/m)?.[1] ?? null;
}

function markdownFilesUnderDocs() {
  return [
    "README.md",
    "docs/README.md",
    ...readdirSync(join(repoRoot, "docs")).flatMap((entry) => {
      const path = join("docs", entry);
      const fullPath = join(repoRoot, path);
      return statSync(fullPath).isFile() && path.endsWith(".md") ? [path] : [];
    }),
  ];
}

function extractMarkdownLinks(source: string) {
  return [...source.matchAll(/(?<!!)\[[^\]]+\]\(([^)]+)\)/g)].map((match) => match[1]);
}

function isRepositoryRelativeLink(link: string) {
  return (
    !link.startsWith("http://") && !link.startsWith("https://") && !link.startsWith("mailto:") && !link.startsWith("#")
  );
}

function stripAnchor(link: string) {
  const [path] = link.split("#");
  return decodeURIComponent(path);
}

function migrationVersionsFromFiles() {
  return readdirSync(join(repoRoot, "src-tauri/migrations"))
    .flatMap((entry) => {
      const version = entry.match(/^V(\d+)__.+\.sql$/)?.[1];
      return version ? [Number(version)] : [];
    })
    .sort((a, b) => a - b);
}

function extractRustLatestMigrationVersion(source: string) {
  return Number(source.match(/pub const LATEST_VERSION: i32 = (\d+);/)?.[1] ?? Number.NaN);
}

describe("repository static contracts", () => {
  it("keeps CI mise tasks resolvable", () => {
    const miseTasks = extractMiseTaskNames(readRepoFile("mise.toml"));
    const ciTasks = extractMiseRunTasks(readRepoFile(".github/workflows/ci.yml"));

    expect([...new Set(ciTasks)].sort()).toEqual(["app:build:debug", "build", "format:check", "lint", "test:ci"]);
    expect(ciTasks.filter((task) => !miseTasks.has(task))).toEqual([]);
  });

  it("keeps Storybook addons and framework backed by dev dependencies", () => {
    const devDependencies = packageJson.devDependencies as Record<string, string>;
    const addons = storybookConfig.addons ?? [];
    const addonNames = addons.map((addon) => (typeof addon === "string" ? addon : addon.name));
    const framework =
      typeof storybookConfig.framework === "string" ? storybookConfig.framework : storybookConfig.framework?.name;

    expect([...addonNames, framework].filter((name): name is string => Boolean(name))).toEqual([
      "@storybook/addon-a11y",
      "@storybook/addon-docs",
      "@storybook/react-vite",
    ]);
    expect(
      [...addonNames, framework].filter((name): name is string => Boolean(name) && !(name in devDependencies)),
    ).toEqual([]);
  });

  it("keeps repository-relative documentation links pointing at existing files", () => {
    const brokenLinks = markdownFilesUnderDocs().flatMap((filePath) => {
      const source = readRepoFile(filePath);
      return extractMarkdownLinks(source)
        .filter(isRepositoryRelativeLink)
        .map(stripAnchor)
        .filter((link) => link.length > 0)
        .flatMap((link) => {
          const target = normalize(resolve(repoRoot, dirname(filePath), link));
          return target.startsWith(repoRoot) && existsSync(target) ? [] : [`${filePath} -> ${link}`];
        });
    });

    expect(brokenLinks).toEqual([]);
  });

  it("keeps historical command replacements pointed at current mise tasks", () => {
    const superpowersReadme = readRepoFile("docs/superpowers/README.md");
    const miseTasks = extractMiseTaskNames(readRepoFile("mise.toml"));
    const replacementTargets = extractMiseRunTasks(superpowersReadme);

    expect(replacementTargets).toEqual(["app:dev", "app:dev:browser"]);
    expect(replacementTargets.filter((task) => !miseTasks.has(task))).toEqual([]);
  });

  it("keeps release workflow permissions and signing secret preflight visible", () => {
    const releaseWorkflow = readRepoFile(".github/workflows/release.yml");
    const signingKeyExpression = "$" + "{{ secrets.TAURI_SIGNING_PRIVATE_KEY }}";
    const signingPasswordExpression = "$" + "{{ secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD }}";

    expect(releaseWorkflow).toContain('tags: ["v*"]');
    expect(releaseWorkflow).toContain("contents: write");
    expect(releaseWorkflow).toContain("if: startsWith(github.ref, 'refs/tags/v')");
    expect(releaseWorkflow).toContain(`TAURI_SIGNING_PRIVATE_KEY: ${signingKeyExpression}`);
    expect(releaseWorkflow).toContain(`TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${signingPasswordExpression}`);
    expect(releaseWorkflow).toContain("releaseDraft: true");
    expect(releaseWorkflow).toContain("--config src-tauri/tauri.release.conf.json --ci");
    expect(tauriReleaseConfig.bundle.createUpdaterArtifacts).toBe(true);
  });

  it("keeps release dry-run version sources consistent", () => {
    const packageVersion = packageJson.version;
    const cargoVersion = extractCargoPackageVersion(readRepoFile("src-tauri/Cargo.toml"));

    expect(packageVersion).toMatch(/^\d+\.\d+\.\d+$/);
    expect(cargoVersion).toBe(packageVersion);
    expect(tauriConfig.version).toBe(packageVersion);
    expect(readRepoFile("README.md")).toContain(
      "Version is kept in sync across `tauri.conf.json`, `Cargo.toml`, and `package.json`.",
    );
  });

  it("keeps migration manifest versions aligned with the Rust runner", () => {
    const migrationSource = readRepoFile("src-tauri/src/infra/db/migration.rs");
    const fileVersions = migrationVersionsFromFiles();
    const latestVersion = extractRustLatestMigrationVersion(migrationSource);
    const expectedVersions = Array.from({ length: latestVersion }, (_, index) => index + 1);
    const missingFileVersions = expectedVersions.filter((version) => !fileVersions.includes(version));
    const unhandledFileVersions = fileVersions.filter((version) => {
      const hasEmbeddedSql = migrationSource.includes(`MIGRATION_V${version}`);
      const hasInlineHelper = migrationSource.includes(`apply_v${version}_`);
      return !hasEmbeddedSql && !hasInlineHelper;
    });

    expect(latestVersion).toBe(Math.max(...fileVersions));
    expect(missingFileVersions).toEqual([10]);
    expect(migrationSource).toContain("set_schema_version(&tx, 10)");
    expect(unhandledFileVersions).toEqual([]);
  });

  it("keeps dev scenario implementation behind the runtime production guard", () => {
    const scenarioRuntime = readRepoFile("src/dev/scenario-runtime.ts");
    const runtimeGuardIndex = scenarioRuntime.indexOf("if (!import.meta.env.DEV)");
    const sourceFiles = [
      ...readdirSync(join(repoRoot, "src"), { recursive: true })
        .filter((entry): entry is string => typeof entry === "string")
        .filter((entry) => /\.(ts|tsx)$/.test(entry)),
    ];
    const eagerScenarioImports = sourceFiles.flatMap((entry) => {
      const filePath = `src/${entry}`;
      if (filePath.startsWith("src/dev/") || filePath.startsWith("src/__tests__/")) {
        return [];
      }
      const source = readRepoFile(filePath);
      return source.includes("@/dev/scenarios") ? [filePath] : [];
    });

    expect(runtimeGuardIndex).toBeGreaterThanOrEqual(0);
    expect(scenarioRuntime).toContain('return Promise.resolve(Result.fail({ type: "unavailable"');
    expect(scenarioRuntime).toContain("await import(/* @vite-ignore */ getDevScenariosModuleUrl())");
    expect(eagerScenarioImports).toEqual([]);
  });
});
