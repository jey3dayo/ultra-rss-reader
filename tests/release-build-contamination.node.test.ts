import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { checkReleaseBuildSources, checkReleaseDependencyGraph } from "../scripts/check-release-build-contamination";

const roots: string[] = [];
const fixture = () => {
  const root = mkdtempSync(join(tmpdir(), "release-contamination-"));
  roots.push(root);
  for (const file of [
    ".github/workflows/release.yml",
    "src-tauri/tauri.conf.json",
    "src-tauri/tauri.release.conf.json",
    "src-tauri/tauri.dev.conf.json",
    "src-tauri/tauri.linux.release.conf.json",
    "src-tauri/capabilities/default.json",
    "src-tauri/src/lib.rs",
    "src-tauri/Cargo.toml",
    "src/dev/mocks.ts",
    "vite.config.ts",
  ]) {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    copyFileSync(file, join(root, file));
  }
  return root;
};
const change = (root: string, file: string, update: (source: string) => string) => {
  const target = join(root, file);
  writeFileSync(target, update(readFileSync(target, "utf8")));
};
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("release source contamination", () => {
  it("accepts the release configuration without invoking Cargo", () => {
    expect(checkReleaseBuildSources(fixture())).toEqual([]);
  });

  it.each([
    ["dev config", "--config src-tauri/tauri.dev.conf.json", "must not use src-tauri/tauri.dev.conf.json"],
    ["dev credentials", "DEV_CREDENTIALS: fixture-only", "must not set dev-only credential"],
    ["legacy dev credentials", "ULTRA_RSS_DEV_CREDENTIALS: fixture-only", "must not set dev-only credential"],
  ])("rejects %s in the release workflow", (_name, contamination, message) => {
    const root = fixture();
    change(root, ".github/workflows/release.yml", (source) => `${source}\n${contamination}\n`);
    expect(checkReleaseBuildSources(root)).toEqual(expect.arrayContaining([expect.stringContaining(message)]));
  });

  it.each([
    ["import data from '@/dev/mock-data';", "must not import dev-only"],
    ["const scenario = import('@/dev/scenarios/example');", "must not import dev-only"],
    ["import { setup } from '@/dev/mocks';", "must not statically import"],
  ])("rejects release source contamination: %s", (source, message) => {
    const root = fixture();
    mkdirSync(join(root, "src/nested"));
    writeFileSync(join(root, "src/nested/contaminated.tsx"), source);
    const errors = checkReleaseBuildSources(root);
    expect(errors).toEqual([expect.stringContaining(message)]);
    expect(errors[0]).toContain("src/nested/contaminated.tsx");
  });

  it("rejects a dev identity, permissive CSP, and MCP capability", () => {
    const root = fixture();
    const dev = JSON.parse(readFileSync(join(root, "src-tauri/tauri.dev.conf.json"), "utf8"));
    change(root, "src-tauri/tauri.release.conf.json", (source) =>
      JSON.stringify({ ...JSON.parse(source), identifier: dev.identifier }),
    );
    change(root, "src-tauri/tauri.conf.json", (source) => {
      const config = JSON.parse(source);
      config.app.security.csp += "; connect-src *";
      return JSON.stringify(config);
    });
    change(root, "src-tauri/capabilities/default.json", () =>
      JSON.stringify({ identifier: "main", permissions: ["mcp-bridge:default"] }),
    );
    expect(checkReleaseBuildSources(root)).toEqual(
      expect.arrayContaining([
        "release build must not use the dev bundle identifier",
        "release CSP connect-src must not include *",
        "release capability must not include debug-only MCP bridge permissions",
      ]),
    );
  });

  it("rejects enabling MCP by default or removing its runtime debug guard", () => {
    const root = fixture();
    change(root, "src-tauri/Cargo.toml", (source) =>
      source.replace("[features]", '[features]\ndefault = ["mcp-bridge"]'),
    );
    change(root, "src-tauri/src/lib.rs", (source) =>
      source.replaceAll('#[cfg(all(debug_assertions, feature = "mcp-bridge"))]', ""),
    );
    expect(checkReleaseBuildSources(root)).toEqual(
      expect.arrayContaining([
        'Cargo.toml default features must not enable "mcp-bridge"',
        'release build must keep the MCP bridge plugin behind cfg(all(debug_assertions, feature = "mcp-bridge"))',
      ]),
    );
  });
});

describe("release dependency graph verification", () => {
  it("runs the locked real dependency command with a hard subprocess bound", () => {
    const run = vi.fn(() => "ultra-rss-reader v0.0.0\n└── tauri v2.0.0");
    expect(checkReleaseDependencyGraph(process.cwd(), run)).toEqual([]);
    expect(run).toHaveBeenCalledExactlyOnceWith(
      "cargo",
      ["tree", "--manifest-path", "src-tauri/Cargo.toml", "-e", "normal", "--locked"],
      {
        cwd: process.cwd(),
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        timeout: 120_000,
        killSignal: "SIGKILL",
      },
    );
  });

  it("rejects a transitive MCP dependency", () => {
    expect(
      checkReleaseDependencyGraph(process.cwd(), () => "app\n└── transitive\n    └── tauri-plugin-mcp-bridge v0.1.0"),
    ).toEqual([expect.stringContaining("must not include tauri-plugin-mcp-bridge")]);
  });

  it.each(["ENOENT", "ETIMEDOUT", "cargo failed", "no matching package found; offline mode"])(
    "fails closed on %s",
    (message) => {
      expect(
        checkReleaseDependencyGraph(process.cwd(), () => {
          throw new Error(message);
        }),
      ).toEqual([expect.stringContaining(`timeout 120000ms): ${message}`)]);
    },
  );

  it("fails closed on empty output", () => {
    expect(checkReleaseDependencyGraph(process.cwd(), () => " \n")).toEqual([expect.stringContaining("empty output")]);
  });

  it("reports a real nonzero child exit and its stderr", () => {
    const errors = checkReleaseDependencyGraph(process.cwd(), (_command, _args, options) =>
      execFileSync(process.execPath, ["-e", 'console.error("dependency resolution failed"); process.exit(7)'], options),
    );
    expect(errors).toEqual([expect.stringContaining("dependency resolution failed")]);
  });

  it("makes the CLI exit nonzero when Cargo is unavailable", () => {
    const result = spawnSync(process.execPath, [join(process.cwd(), "scripts/check-release-build-contamination.ts")], {
      cwd: fixture(),
      env: { ...process.env, PATH: "", Path: "" },
      encoding: "utf8",
      timeout: 10_000,
    });
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(result.stdout).toContain("Release source validation:");
    expect(result.stdout).toContain("Release dependency graph validation:");
    expect(result.stdout).not.toContain("Release build contamination contract passed");
    expect(result.stderr).toContain("unable to verify the release dependency graph");
    expect(result.stderr).toContain("ENOENT");
  });

  it("terminates a stalled child and reports the actual runner timeout", () => {
    const errors = checkReleaseDependencyGraph(process.cwd(), (_command, _args, options) =>
      execFileSync(process.execPath, ["-e", 'console.error("waiting for Cargo lock"); setInterval(() => {}, 1000)'], {
        ...options,
        timeout: 100,
      }),
    );
    expect(errors).toEqual([expect.stringContaining("ETIMEDOUT")]);
  });
});
