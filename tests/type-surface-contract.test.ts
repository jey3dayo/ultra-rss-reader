import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { createTypeSurfaceHelper } from "@tests/helpers/type-surface";
import { remainingTypeSurface, remainingTypeSurfaceAllowlist } from "@tests/helpers/type-surface-allowlist";
import { describe, expect, it } from "vitest";

function writeRepoFile(repoRoot: string, path: string, source: string) {
  const filePath = join(repoRoot, path);
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, source);
}

describe("type surface contract helper", () => {
  it("reports exported interfaces that are no longer referenced outside the surface file", () => {
    const repoRoot = mkdtempSync(join(tmpdir(), "type-surface-"));
    writeRepoFile(repoRoot, "src/surface.types.ts", "export interface PublicProps { id: string }\n");
    writeRepoFile(repoRoot, "src/consumer.ts", "const unrelated = true;\n");

    const helper = createTypeSurfaceHelper({
      expect,
      repoRoot,
      searchDirectories: ["src"],
    });

    expect(
      helper.collectPublicContractDiagnostics({
        label: "test public contract",
        typeFileList: ["src/surface.types.ts"],
      }),
    ).toEqual([
      "src/surface.types.ts:PublicProps should stay in test public contract or move out of the public type surface",
    ]);
  });

  it("reports re-exported types that are no longer referenced outside the surface file", () => {
    const repoRoot = mkdtempSync(join(tmpdir(), "type-surface-"));
    writeRepoFile(repoRoot, "src/internal.ts", "export type PublicResult = { ok: boolean };\n");
    writeRepoFile(repoRoot, "src/surface.types.ts", 'export type { PublicResult } from "./internal";\n');
    writeRepoFile(repoRoot, "src/consumer.ts", "const unrelated = true;\n");

    const helper = createTypeSurfaceHelper({
      expect,
      repoRoot,
      searchDirectories: ["src"],
    });

    expect(
      helper.collectPublicContractDiagnostics({
        label: "test public contract",
        typeFileList: ["src/surface.types.ts"],
      }),
    ).toEqual([
      "src/surface.types.ts:PublicResult should stay in test public contract or move out of the public type surface",
    ]);
  });

  it("reports remaining type surface files that drift outside the allowlist", () => {
    const repoRoot = mkdtempSync(join(tmpdir(), "type-surface-"));
    writeRepoFile(repoRoot, "src/known.types.ts", "export type KnownContract = { id: string };\n");
    writeRepoFile(repoRoot, "src/new.types.ts", "export type NewContract = { id: string };\n");

    const helper = createTypeSurfaceHelper({
      expect,
      repoRoot,
      searchDirectories: ["src"],
    });

    expect(() =>
      helper.assertRemainingTypeSurfaceAllowlist({
        label: "test remaining allowlist",
        typeFileList: [remainingTypeSurface("src/known.types.ts")],
      }),
    ).toThrowError();
  });
});

describe("reader/settings/subscriptions type surface contract", () => {
  it("keeps the remaining .types.ts files on an explicit allowlist", () => {
    const helper = createTypeSurfaceHelper({
      expect,
      repoRoot: process.cwd(),
      searchDirectories: [
        "src/components/reader",
        "src/components/settings",
        "src/lib/subscriptions",
        "src/lib/sync",
        "src/lib/ui",
        "src/stores",
      ],
    });

    helper.assertRemainingTypeSurfaceAllowlist({
      label: "reader/settings/subscriptions remaining .types.ts allowlist",
      typeFileList: remainingTypeSurfaceAllowlist,
    });
  });
});
