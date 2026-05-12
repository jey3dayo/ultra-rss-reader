import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();

function readRepoFile(path: string): string {
  return readFileSync(join(repoRoot, path), "utf8");
}

function expectAll(source: string, terms: readonly string[]): void {
  for (const term of terms) {
    expect(source).toContain(term);
  }
}

describe("test isolation policy contract", () => {
  it("documents frontend parallelism and shared global reset responsibilities", () => {
    const docsIndex = readRepoFile("docs/README.md");

    expectAll(docsIndex, [
      "Test isolation policy",
      "Frontend suites must be safe to run in parallel",
      "localStorage",
      "sessionStorage",
      "fake timers",
      "singleton stores",
      "restore them in `afterEach`",
      "must not depend on file execution order",
    ]);
  });

  it("keeps Vitest projects split without disabling file isolation", () => {
    const vitestConfig = readRepoFile("vitest.config.ts");

    expectAll(vitestConfig, [
      'const jsdomSetupFiles = ["tests/setup.ts"] as const;',
      'const nodeProjectName = "node";',
      'const jsdomProjectName = "jsdom";',
      "const nodeProjectGroupOrder = 0;",
      "const jsdomProjectGroupOrder = 1;",
      "const nodeEnvironmentTestGlobs = [",
      "src/__tests__/api/schemas/**/*.test.ts",
      "src/__tests__/constants/**/*.test.ts",
      "src/__tests__/schemas/**/*.test.ts",
      "src/__tests__/scripts/**/*.test.ts",
      "src/__tests__/styles/**/*.test.ts",
      "src/__tests__/config/ci-workflow-contract.test.ts",
      "src/__tests__/dev/scenarios/registry.test.ts",
      "tests/helpers/repo-contract-parser.test.ts",
      'const nodeNamedTestGlobs = ["src/**/*.node.test.{ts,tsx}"] as const;',
      "const legacyNodeEnvironmentTestFiles = [",
      "name: nodeProjectName",
      "environment: nodeProjectName",
      "...nodeEnvironmentTestGlobs",
      "...nodeNamedTestGlobs",
      "...legacyNodeEnvironmentTestFiles",
      "setupFiles: []",
      "name: jsdomProjectName",
      "environment: jsdomProjectName",
      "setupFiles: [...jsdomSetupFiles]",
      "groupOrder: nodeProjectGroupOrder",
      "groupOrder: jsdomProjectGroupOrder",
    ]);
    expect(vitestConfig).not.toMatch(/src\/__tests__\/components\/\*\*/);
    expect(vitestConfig).not.toMatch(/src\/__tests__\/lib\/\*\*/);
    expect(vitestConfig).not.toMatch(/\bisolate\s*:\s*false\b/);
    expect(vitestConfig).not.toMatch(/\benvironmentMatchGlobs\s*:/);
    expect(vitestConfig).not.toMatch(/\bpoolOptions\s*:/);
  });

  it("keeps the shared frontend teardown responsible for mutable globals", () => {
    const setup = readRepoFile("tests/setup.ts");

    expectAll(setup, [
      "restoreProcessEnv",
      'clearWorkingStorage(readWorkingWindowStorage("localStorage"))',
      'clearWorkingStorage(readWorkingWindowStorage("sessionStorage"))',
      "vi.useRealTimers()",
      "resetCommandHistoryStorageFailureWarnings()",
      "resetStartupSyncStorageFailureWarnings()",
      "resetTestObserverMocks()",
      "restoreStorageDescriptors()",
    ]);
  });

  it("documents Rust global state and test thread isolation boundaries", () => {
    const docsIndex = readRepoFile("docs/README.md");

    expectAll(docsIndex, [
      "Rust integration tests must use per-test temporary directories",
      "environment-variable guards",
      "Shared process state such as `OnceLock`",
      "protected by a serial guard",
    ]);
  });

  it("keeps Rust env-mutating tests behind named guards", () => {
    const platformCommands = readRepoFile("src-tauri/src/commands/platform_commands.rs");
    const syncProviders = readRepoFile("src-tauri/src/commands/sync_providers.rs");
    const httpDefaults = readRepoFile("src-tauri/src/infra/provider/http_defaults.rs");

    expect(platformCommands).toContain("static ENV_LOCK: Mutex<()> = Mutex::new(())");
    expect(syncProviders).toContain("static DEV_CREDENTIALS_ENV_LOCK");
    expect(httpDefaults).toContain("static PROXY_ENV_LOCK");
  });

  it("keeps reset-resistant Rust OnceLock state wrapped in mutex-owned contracts", () => {
    const rustSources = [
      readRepoFile("src-tauri/src/menu.rs"),
      readRepoFile("src-tauri/src/service/sync_scheduler.rs"),
      readRepoFile("src-tauri/src/commands/article_commands.rs"),
    ];

    for (const source of rustSources) {
      for (const match of source.matchAll(/static\s+\w+:\s+OnceLock<([^>]+)>/g)) {
        expect(match[1], match[0]).toContain("Mutex");
      }
    }
  });
});
