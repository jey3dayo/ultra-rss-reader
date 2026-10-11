import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("../", import.meta.url));
const coldSources = [
  "scripts/release/start-release.ts",
  "scripts/release/guard-release-build.ts",
  "scripts/release/validate-source.ts",
  "scripts/release/validate-release-config.ts",
  "scripts/release/lib/github-client.ts",
  "scripts/release/lib/release-start-policy.ts",
  "scripts/release/lib/release-source-policy.ts",
  "scripts/release/lib/config-validation.ts",
  "scripts/release/lib/version-owners.ts",
  "scripts/release/workflows/start-release.ts",
  "scripts/release/workflows/guard-release-build.ts",
  "scripts/release/workflows/validate-source.ts",
];

const fixtureParent = join(root, "tmp/refactoring/release-cold-fixture");
mkdirSync(fixtureParent, { recursive: true });
const fixture = mkdtempSync(join(fixtureParent, "snapshot-"));
afterAll(() => {
  rmSync(fixture, { recursive: true, force: true });
});
for (const source of coldSources) {
  const target = join(fixture, source);
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(join(root, source), target);
}
const configInputs: Record<string, string> = {
  "package.json": '{"type":"module"}',
  "src-tauri/tauri.conf.json": "{}",
  "src-tauri/tauri.release.conf.json": "{}",
  "src-tauri/tauri.dev.conf.json": "{}",
  "src-tauri/capabilities/default.json": "[]",
  "src-tauri/Cargo.toml": "",
  "src-tauri/Cargo.lock": "",
  ".github/workflows/release.yml": "",
  "msix/Package.appxmanifest": "",
};
for (const [path, content] of Object.entries(configInputs)) {
  const target = join(fixture, path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content);
}
const driver = join(fixture, "cold-driver.mjs");
writeFileSync(
  driver,
  `import childProcess from "node:child_process";
import { registerHooks, syncBuiltinESMExports } from "node:module";
import { pathToFileURL } from "node:url";
childProcess.execFileSync = () => { throw new Error("io-denied:execFileSync"); };
syncBuiltinESMExports();
globalThis.fetch = async () => { throw new Error("io-denied:fetch"); };
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (!/^(node:|file:|\\.\\.?\\/)/.test(specifier)) {
      throw new Error("package-denied:" + specifier);
    }
    return nextResolve(specifier, context);
  },
});
if (process.env.PROBE_PACKAGE) {
  await import(process.env.PROBE_PACKAGE);
} else {
  process.argv[1] = process.argv[2];
  await import(pathToFileURL(process.argv[1]).href);
}
`,
);

const run = (entry: string, env: Record<string, string> = {}) =>
  spawnSync(process.execPath, [driver, join(fixture, "scripts/release", entry)], {
    cwd: fixture,
    env,
    encoding: "utf8",
    timeout: 10_000,
  });

describe("release CLIs before dependency installation", () => {
  it.each(["@praha/byethrow", "valibot"])("denies %s even when ancestor node_modules contains it", (name) => {
    const result = run("start-release.ts", { PROBE_PACKAGE: name });
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(`package-denied:${name}`);
  });

  it.each([
    ["start-release.ts", {}, "Missing RELEASE_TAG"],
    ["guard-release-build.ts", {}, "Invalid release tag"],
    ["validate-source.ts", {}, "missing required environment variable EVENT_NAME"],
    ["validate-release-config.ts", {}, "::error::package.json version (missing) must be a stable X.Y.Z version"],
    [
      "start-release.ts",
      { RELEASE_TAG: "invalid", EXPECTED_SHA: "a".repeat(40) },
      "release_tag must be a stable vX.Y.Z tag without leading zeroes",
    ],
    ["guard-release-build.ts", { RELEASE_TAG: "v0.64.4" }, "Invalid release commit or run ID"],
    [
      "validate-source.ts",
      {
        EVENT_NAME: "workflow_dispatch",
        RELEASE_TAG: "invalid",
        WORKFLOW_REF: "refs/heads/main",
        WORKFLOW_REF_NAME: "main",
      },
      "::error::release tag must match vX.Y.Z, optionally with prerelease or build metadata",
    ],
  ])("loads %s and rejects dummy inputs before any IO", (entry, env, message) => {
    const result = run(entry, env);
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(result.stderr).not.toContain("package-denied:");
    expect(result.stderr).not.toContain("io-denied:");
    expect(result.stderr).toContain(message);
    expect(result.stdout).toBe("");
  });
});
