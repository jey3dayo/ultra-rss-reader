import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

type PackageJson = {
  name: string;
  private: boolean;
  version: string;
};

type TauriConfig = {
  productName: string;
  version: string;
  identifier: string;
  bundle?: {
    createUpdaterArtifacts?: boolean;
  };
};

const readText = (path: string): string => readFileSync(path, "utf8");

const extractTomlString = (source: string, key: string): string => {
  const value = source.match(new RegExp(`^${key} = "([^"]+)"$`, "m"))?.[1];
  if (!value) {
    throw new Error(`Missing TOML string: ${key}`);
  }
  return value;
};

const extractReleaseCacheBlock = (source: string): string => {
  const value = source.match(
    /- uses: actions\/cache@27d5ce7f107fe9357f9df03efb73ab90386fccae\n(?<block>(?: {8}.+\n?)*)/,
  )?.groups?.block;
  if (!value) {
    throw new Error("Missing release pnpm cache block");
  }
  return value;
};

describe("release repository contract", () => {
  const packageJson: PackageJson = JSON.parse(readText("package.json"));
  const tauriConfig: TauriConfig = JSON.parse(readText("src-tauri/tauri.conf.json"));
  const tauriReleaseConfig: TauriConfig = JSON.parse(readText("src-tauri/tauri.release.conf.json"));
  const cargoToml = readText("src-tauri/Cargo.toml");
  const releaseWorkflow = readText(".github/workflows/release.yml");
  const ciWorkflow = readText(".github/workflows/ci.yml");
  const miseToml = readText("mise.toml");

  it("keeps release tag, package, Tauri, and Cargo versions in one parity contract", () => {
    expect(packageJson.version).toBe(tauriConfig.version);
    expect(packageJson.version).toBe(extractTomlString(cargoToml, "version"));
    expect(releaseWorkflow).toContain("Validate release version parity");
    expect(releaseWorkflow).toContain("release tag ${releaseTag}");
    expect(releaseWorkflow).toContain("src-tauri/tauri.conf.json version");
    expect(releaseWorkflow).toContain("src-tauri/Cargo.toml version");
  });

  it("serializes tag push and manual release runs by release tag", () => {
    expect(releaseWorkflow).toContain(
      "group: ${{ github.workflow }}-${{ github.event_name == 'workflow_dispatch' && inputs.release_tag || github.ref_name }}",
    );
    expect(releaseWorkflow).toContain("cancel-in-progress: false");
    expect(releaseWorkflow).toContain("workflow_dispatch");
    expect(releaseWorkflow).toContain("push:");
    expect(releaseWorkflow).toContain('tags: ["v*"]');
  });

  it("checks release source and version parity before artifact creation", () => {
    expect(releaseWorkflow).toContain("Validate release source");
    expect(releaseWorkflow).toContain(
      'git fetch --force --tags origin "refs/tags/$RELEASE_TAG:refs/tags/$RELEASE_TAG"',
    );
    expect(releaseWorkflow).toContain('tag_target_sha="$(git rev-parse "refs/tags/$RELEASE_TAG^{}")"');
    expect(releaseWorkflow).toContain('checkout_sha="$(git rev-parse HEAD)"');
    expect(releaseWorkflow.indexOf("Validate release source")).toBeLessThan(
      releaseWorkflow.indexOf("Resolve pnpm store path"),
    );
    expect(releaseWorkflow.indexOf("Validate release version parity")).toBeLessThan(
      releaseWorkflow.indexOf("tauri-apps/tauri-action"),
    );
  });

  it("keeps release dependency cache exact-lockfile only", () => {
    const releaseCacheBlock = extractReleaseCacheBlock(releaseWorkflow);

    expect(releaseCacheBlock).toContain("key: ${{ runner.os }}-pnpm-store-${{ hashFiles('pnpm-lock.yaml') }}");
    expect(releaseCacheBlock).not.toContain("restore-keys:");
  });

  it("keeps release artifact display metadata source-of-truth explicit", () => {
    expect(packageJson.name).toBe("ultra-rss-reader");
    expect(packageJson.private).toBe(true);
    expect(extractTomlString(cargoToml, "name")).toBe(packageJson.name);
    expect(extractTomlString(cargoToml, "description")).toBe("A Tauri-based RSS reader");
    expect(tauriConfig.productName).toBe("Ultra RSS Reader");
    expect(tauriConfig.identifier).toBe("com.jey3dayo.ultra-rss-reader");
    expect(tauriReleaseConfig.identifier).toBe(tauriConfig.identifier);
    expect(tauriConfig.bundle?.createUpdaterArtifacts).toBe(false);
    expect(tauriReleaseConfig.bundle?.createUpdaterArtifacts).toBe(true);
  });

  it("keeps dependency audit manual until advisory policy is defined", () => {
    expect(miseToml).toContain('[tasks."audit:deps"]');
    expect(miseToml).toContain("Manual dependency security audit");
    expect(ciWorkflow).not.toMatch(/\b(?:pnpm|cargo)\s+audit\b/);
    expect(releaseWorkflow).not.toMatch(/\b(?:pnpm|cargo)\s+audit\b/);
    expect(miseToml).not.toMatch(/depends = \[[^\]]*"audit:deps"/);
  });
});
