import type { SpawnSyncReturns } from "node:child_process";
import { describe, expect, it } from "vitest";
import {
  buildDependencyLicenseInventory,
  buildLockfileDuplicateMajorReport,
  buildTailwindArbitraryValueInventory,
  classifyTailwindArbitraryValue,
  createProcessDiagnostic,
  createReportDiagnostic,
  dependencyLicenseInventoryContract,
  dependencyUpdateSmokeContract,
  isQualityBaselineRepoScanIgnoredPath,
  isTailwindArbitraryValueInventorySourcePath,
  parseKnipReport,
  parseReactDoctorReport,
  partitionQualityBaselineRepoScanPaths,
  qualityBaselineRepoScanIgnoredPathPrefixes,
  readJsonPayload,
  tailwindArbitraryValuesInventoryContract,
} from "../../../scripts/quality-baseline";

describe("quality-baseline", () => {
  it("extracts JSON after tool version and log prefixes", () => {
    const output = [
      "react-doctor 0.2.3",
      "info: running offline scan",
      '{"version":"0.2.3","mode":"diff","summary":{"score":100,"errorCount":0,"warningCount":0,"affectedFileCount":0}}',
    ].join("\n");

    expect(parseReactDoctorReport(output)).toEqual({
      version: "0.2.3",
      mode: "diff",
      summary: {
        score: 100,
        errorCount: 0,
        warningCount: 0,
        affectedFileCount: 0,
      },
    });
  });

  it("keeps nested braces and braces inside strings inside the JSON payload", () => {
    const output = [
      "knip 6.15.0",
      '{"issues":[{"file":"src/example.ts","exports":["useThing"],"note":"literal { brace }"}]}',
      "scan finished",
    ].join("\n");

    expect(parseKnipReport(output)).toEqual({
      issues: [
        {
          file: "src/example.ts",
          exports: ["useThing"],
          note: "literal { brace }",
        },
      ],
    });
  });

  it("skips malformed brace-prefixed logs and reads the first valid JSON object", () => {
    const output = '{not json}\n{"issues":[]}';

    expect(readJsonPayload(output)).toBe('{"issues":[]}');
  });

  it("reads the React Doctor report after structured JSON log prefixes", () => {
    const output = [
      '{"level":"info","message":"scan started"}',
      '{"version":"0.2.3","mode":"full","summary":{"score":85,"errorCount":0,"warningCount":228,"affectedFileCount":87}}',
      "warning: trailing text",
    ].join("\n");

    expect(parseReactDoctorReport(output)).toEqual({
      version: "0.2.3",
      mode: "full",
      summary: {
        score: 85,
        errorCount: 0,
        warningCount: 228,
        affectedFileCount: 87,
      },
    });
  });

  it("accepts React Doctor offline reports without score output", () => {
    const output =
      '{"version":"0.2.3","mode":"diff","summary":{"score":null,"errorCount":0,"warningCount":0,"affectedFileCount":0}}';

    expect(parseReactDoctorReport(output)).toEqual({
      version: "0.2.3",
      mode: "diff",
      summary: {
        score: null,
        errorCount: 0,
        warningCount: 0,
        affectedFileCount: 0,
      },
    });
  });

  it("reads the Knip report after unrelated JSON objects", () => {
    const output = '{"event":"start"}\n{"issues":[]}';

    expect(parseKnipReport(output)).toEqual({ issues: [] });
  });

  it("throws a stable error when tool output does not contain valid JSON", () => {
    expect(() => readJsonPayload("react-doctor 0.2.3\nno json payload")).toThrow(
      "Tool output did not contain a JSON object.",
    );
  });

  it("rejects JSON array output as a malformed tool report", () => {
    expect(() => parseKnipReport('[{"file":"src/example.ts"}]')).toThrow(
      "Knip did not return a valid report JSON object.",
    );
  });

  it("reports a missing command from the process error code", () => {
    const error = Object.assign(new Error("spawn pnpm ENOENT"), {
      code: "ENOENT",
    });

    expect(
      createProcessDiagnostic("React Doctor", "pnpm exec react-doctor", spawnResult({ error, status: null })),
    ).toMatchObject({
      kind: "missing-command",
      tool: "React Doctor",
      command: "pnpm exec react-doctor",
    });
  });

  it("reports non-zero exits with status and stderr", () => {
    expect(
      createProcessDiagnostic(
        "React Doctor",
        "pnpm exec react-doctor",
        spawnResult({ status: 2, stderr: "failed to load config" }),
      ),
    ).toMatchObject({
      kind: "non-zero-exit",
      exitCode: 2,
      stderr: "failed to load config",
    });
  });

  it("reports empty tool reports separately from malformed reports", () => {
    expect(createReportDiagnostic("React Doctor", "pnpm exec react-doctor", "", new Error("no json"))).toMatchObject({
      kind: "empty-report",
      stdout: undefined,
    });

    expect(
      createReportDiagnostic("React Doctor", "pnpm exec react-doctor", "react-doctor 0.2.3\n{not json}", new Error()),
    ).toMatchObject({
      kind: "malformed-report",
      stdout: "react-doctor 0.2.3\n{not json}",
    });
  });

  it("reports malformed version probes with the probed command and captured stdout", () => {
    expect(
      createReportDiagnostic("Knip", "pnpm exec knip --version", "knip dev build", "Could not read Knip version."),
    ).toEqual({
      kind: "malformed-report",
      tool: "Knip",
      command: "pnpm exec knip --version",
      message: "Knip returned output, but no valid report JSON could be parsed.",
      stdout: "knip dev build",
      stderr: undefined,
    });
  });

  it("reports timeouts from the process error code", () => {
    const error = Object.assign(new Error("spawnSync pnpm ETIMEDOUT"), {
      code: "ETIMEDOUT",
    });

    expect(
      createProcessDiagnostic(
        "React Doctor",
        "pnpm exec react-doctor",
        spawnResult({ error, signal: "SIGTERM", status: null }),
      ),
    ).toMatchObject({
      kind: "timeout",
      signal: "SIGTERM",
    });
  });

  it("reports unexpected process errors before report parsing", () => {
    const error = Object.assign(new Error("spawnSync pnpm EACCES"), {
      code: "EACCES",
    });

    expect(createProcessDiagnostic("Knip", "pnpm exec knip", spawnResult({ error, status: null }))).toMatchObject({
      kind: "process-error",
      stderr: "spawnSync pnpm EACCES",
    });
  });

  it("reports signal termination while preserving captured output", () => {
    expect(
      createProcessDiagnostic(
        "Knip",
        "pnpm exec knip",
        spawnResult({
          signal: "SIGKILL",
          status: null,
          stdout: "partial json",
          stderr: "killed",
        }),
      ),
    ).toMatchObject({
      kind: "signal",
      signal: "SIGKILL",
      stdout: "partial json",
      stderr: "killed",
    });
  });

  it("keeps generated schemas and target artifacts out of quality repo scans", () => {
    expect(qualityBaselineRepoScanIgnoredPathPrefixes).toEqual(
      expect.arrayContaining(["src-tauri/target/", "src-tauri/gen/schemas/"]),
    );

    expect(isQualityBaselineRepoScanIgnoredPath("src-tauri/target/debug/build.rs")).toBe(true);
    expect(isQualityBaselineRepoScanIgnoredPath(".\\src-tauri\\gen\\schemas\\desktop-schema.json")).toBe(true);
    expect(isQualityBaselineRepoScanIgnoredPath("src-tauri/capabilities/default.json")).toBe(false);
    expect(isQualityBaselineRepoScanIgnoredPath("src/api/schemas.ts")).toBe(false);
  });

  it("partitions quality repo scan paths without hiding source-owned schemas", () => {
    expect(
      partitionQualityBaselineRepoScanPaths([
        "src/api/schemas.ts",
        "src-tauri/gen/schemas/capabilities.json",
        "src-tauri/capabilities/default.json",
        "src-tauri/target/debug/app",
      ]),
    ).toEqual({
      includedPaths: ["src/api/schemas.ts", "src-tauri/capabilities/default.json"],
      ignoredPaths: ["src-tauri/gen/schemas/capabilities.json", "src-tauri/target/debug/app"],
    });
  });

  it("classifies duplicate lockfile majors by direct dependency and allowlist status", () => {
    const lockfile = [
      "lockfileVersion: '9.0'",
      "",
      "packages:",
      "  '@vitest/expect@3.2.4':",
      "    resolution: {integrity: sha512-old}",
      "  '@vitest/expect@4.1.5':",
      "    resolution: {integrity: sha512-new}",
      "  'direct-lib@1.0.0':",
      "    resolution: {integrity: sha512-one}",
      "  'direct-lib@2.0.0':",
      "    resolution: {integrity: sha512-two}",
    ].join("\n");

    expect(
      buildLockfileDuplicateMajorReport(lockfile, {
        dependencies: { "direct-lib": "^2.0.0" },
      }),
    ).toEqual({
      duplicatePackageCount: 2,
      duplicateMajorCount: 4,
      directDuplicatePackageCount: 1,
      unreviewedDuplicatePackageCount: 1,
      entries: [
        {
          name: "@vitest/expect",
          majors: [3, 4],
          versions: ["3.2.4", "4.1.5"],
          dependencyType: "transitive",
          allowed: true,
          reason: expect.any(String),
        },
        {
          name: "direct-lib",
          majors: [1, 2],
          versions: ["1.0.0", "2.0.0"],
          dependencyType: "direct",
          allowed: false,
          reason: undefined,
        },
      ],
    });
  });

  it("classifies Tailwind arbitrary values into review buckets", () => {
    expect(classifyTailwindArbitraryValue("max-w-[24ch]")).toBe("layout-critical");
    expect(classifyTailwindArbitraryValue("motion-safe:duration-[180ms]")).toBe("motion-critical");
    expect(classifyTailwindArbitraryValue("z-[60]")).toBe("z-index");
    expect(classifyTailwindArbitraryValue("text-[color:var(--section-heading-color)]")).toBe("token-candidate");
    expect(classifyTailwindArbitraryValue("supports-[backdrop-filter]:bg-background/80")).toBe("one-off-allowed");
  });

  it("builds a Tailwind arbitrary value inventory across app UI ownership scopes", () => {
    expect(tailwindArbitraryValuesInventoryContract.categories).toEqual([
      "layout-critical",
      "motion-critical",
      "z-index",
      "token-candidate",
      "one-off-allowed",
    ]);
    expect(isTailwindArbitraryValueInventorySourcePath("src/components/app-shell.tsx")).toBe(true);
    expect(isTailwindArbitraryValueInventorySourcePath("src/components/reader/article-list.tsx")).toBe(true);
    expect(isTailwindArbitraryValueInventorySourcePath("src/components/settings/account-view.tsx")).toBe(true);
    expect(isTailwindArbitraryValueInventorySourcePath("src/__tests__/components/app.test.tsx")).toBe(false);

    const inventory = buildTailwindArbitraryValueInventory([
      {
        path: "src/components/app-shell.tsx",
        source: [
          '<div className="grid max-w-[24ch] text-[color:var(--shell-label)] z-[60]">',
          '<span className="motion-safe:duration-[180ms] supports-[backdrop-filter]:bg-background/80" />',
        ].join("\n"),
      },
      {
        path: "src/components/reader/article-list.tsx",
        source: '<div className="max-w-[88ch]" />',
      },
    ]);

    expect(inventory.summary).toEqual({
      "layout-critical": 2,
      "motion-critical": 1,
      "z-index": 1,
      "token-candidate": 1,
      "one-off-allowed": 1,
    });
    expect(inventory.entries.map((entry) => `${entry.category}:${entry.line}:${entry.className}`)).toEqual([
      "layout-critical:1:max-w-[24ch]",
      "token-candidate:1:text-[color:var(--shell-label)]",
      "z-index:1:z-[60]",
      "motion-critical:2:motion-safe:duration-[180ms]",
      "one-off-allowed:2:supports-[backdrop-filter]:bg-background/80",
      "layout-critical:1:max-w-[88ch]",
    ]);
  });

  it("builds a combined pnpm and Cargo dependency license inventory with review buckets", () => {
    expect(dependencyLicenseInventoryContract.reportPath).toBe("tmp/dependency-license-inventory.json");
    expect(dependencyLicenseInventoryContract.pnpmCommand).toEqual(["pnpm", "licenses", "list", "--json"]);
    expect(dependencyLicenseInventoryContract.cargoCommand).toEqual([
      "cargo",
      "metadata",
      "--manifest-path",
      "src-tauri/Cargo.toml",
      "--format-version",
      "1",
      "--locked",
    ]);

    const inventory = buildDependencyLicenseInventory({
      pnpm: {
        MIT: [{ name: "react", versions: ["19.2.6"] }],
        UNKNOWN: [{ name: "mystery-js@1.0.0" }],
      },
      cargo: {
        packages: [
          { name: "serde", version: "1.0.228", license: "MIT OR Apache-2.0" },
          { name: "internal-crate", version: "0.1.0", license: "" },
        ],
      },
    });

    expect(inventory.ecosystems).toEqual({ pnpm: 2, cargo: 2 });
    expect(inventory.summary).toEqual({
      total: 4,
      unknownLicenseCount: 2,
      dualLicenseCount: 1,
    });
    expect(inventory.findings).toEqual([
      {
        ecosystem: "cargo",
        packageName: "internal-crate",
        version: "0.1.0",
        license: "",
        review: "unknown-license",
      },
      {
        ecosystem: "cargo",
        packageName: "serde",
        version: "1.0.228",
        license: "MIT OR Apache-2.0",
        review: "dual-license",
      },
      {
        ecosystem: "pnpm",
        packageName: "mystery-js@1.0.0",
        version: "1.0.0",
        license: "UNKNOWN",
        review: "unknown-license",
      },
      {
        ecosystem: "pnpm",
        packageName: "react",
        version: "19.2.6",
        license: "MIT",
        review: "ok",
      },
    ]);
  });

  it("classifies dependency update smoke by runtime behavior family", () => {
    expect(dependencyUpdateSmokeContract.categories).toEqual([
      "query-caching",
      "store-equality",
      "tauri-api",
      "vite-dev-server",
      "test-runner",
    ]);
    expect(dependencyUpdateSmokeContract.reviewPolicy).toContain("Classify lockfile updates by runtime behavior");

    expect(dependencyUpdateSmokeContract.packages).toEqual(
      expect.arrayContaining([
        {
          name: "@tanstack/react-query",
          category: "query-caching",
          smoke: "query cache boot/reload contract",
        },
        {
          name: "zustand",
          category: "store-equality",
          smoke: "store selector equality and persistence contract",
        },
        {
          name: "@tauri-apps/api",
          category: "tauri-api",
          smoke: "Tauri command/event wrapper contract",
        },
        {
          name: "vite",
          category: "vite-dev-server",
          smoke: "Tauri dev Vite port and HMR contract",
        },
        {
          name: "vitest",
          category: "test-runner",
          smoke: "unit test environment and setup contract",
        },
      ]),
    );
  });
});

function spawnResult(overrides: Partial<SpawnSyncReturns<string>> = {}): SpawnSyncReturns<string> {
  return {
    pid: 123,
    output: [],
    stdout: "",
    stderr: "",
    status: 0,
    signal: null,
    ...overrides,
  };
}
