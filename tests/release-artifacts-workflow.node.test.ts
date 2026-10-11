import { createHash } from "node:crypto";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  CHECKSUM_ASSETS_LIST,
  DEPENDENCY_PROVENANCE_ASSETS_LIST,
  RELEASE_PROVENANCE_ASSETS_LIST,
  RELEASE_PROVENANCE_DIR,
} from "../scripts/release/lib/release-provenance.ts";
import { runArtifactWorkflow } from "../scripts/release/workflows/artifacts.ts";
import {
  addDirectory,
  addFile,
  createFakeArtifactWorkflowIO,
  expectProcessExit,
} from "./helpers/artifact-workflow-fixture.ts";

const SOURCE_SHA = "a".repeat(40);
const RELEASE_ENV = {
  GITHUB_EVENT_NAME: "push",
  GITHUB_REF: "refs/tags/v1.2.3",
  GITHUB_REF_NAME: "v1.2.3",
  GITHUB_REPOSITORY: "fixture/ultra-rss-reader",
  GITHUB_RUN_ATTEMPT: "1",
  GITHUB_RUN_ID: "123456",
  GITHUB_SERVER_URL: "https://github.example.test",
  GITHUB_WORKFLOW: "Release",
  RELEASE_TAG: "v1.2.3",
  RUNNER_OS: "macOS",
};

const sha256 = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex");

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

describe("release artifacts workflow", () => {
  it("writes the updater checksum sidecar and asset list from the bundle file", () => {
    const fake = createFakeArtifactWorkflowIO();
    const bundleRoot = "src-tauri/target/release/bundle";
    const bundleDirectory = path.join(bundleRoot, "macos");
    const assetName = "Ultra.RSS.Reader_aarch64.app.tar.gz";
    const assetPath = path.join(bundleDirectory, assetName);
    const assetBytes = Buffer.from("isolated updater asset\n");
    addDirectory(fake, bundleRoot, [{ isDirectory: true, name: "macos" }]);
    addDirectory(fake, bundleDirectory, [{ isDirectory: false, name: assetName }]);
    fake.files.set(assetPath, assetBytes);

    runArtifactWorkflow("generate-updater-checksums", { RUNNER_OS: "macOS" }, fake.io);

    expect(fake.files.get(`${assetPath}.sha256`)?.toString()).toBe(`${sha256(assetBytes)}  ${assetName}\n`);
    expect(fake.files.get(CHECKSUM_ASSETS_LIST)?.toString()).toBe(`${assetPath}.sha256\n`);
  });

  it("writes the provenance JSON and asset list through injected Git and file IO", () => {
    const fake = createFakeArtifactWorkflowIO();
    const assetName = "Ultra RSS Reader.app.tar.gz";
    const checksumAssetPath = `src-tauri/target/${assetName}.sha256`;
    const artifactBytes = Buffer.from("isolated release artifact\n");
    addFile(fake, "package.json", '{"type":"module","version":"1.2.3"}\n');
    addFile(fake, CHECKSUM_ASSETS_LIST, `${checksumAssetPath}\n`);
    addFile(fake, checksumAssetPath, `${sha256(artifactBytes)}  ${assetName}\n`);
    addFile(
      fake,
      DEPENDENCY_PROVENANCE_ASSETS_LIST,
      `${RELEASE_PROVENANCE_DIR}/pnpm-licenses-darwin-aarch64.json\n${RELEASE_PROVENANCE_DIR}/cargo-licenses-darwin-aarch64.json\n`,
    );
    fake.gitOutputs.set("rev-parse HEAD", SOURCE_SHA);
    fake.gitOutputs.set(`rev-parse refs/tags/${RELEASE_ENV.RELEASE_TAG}^{}`, SOURCE_SHA);
    fake.gitOutputs.set(`log -1 --format=%s ${SOURCE_SHA}`, "release fixture (#123)");

    runArtifactWorkflow("generate-release-provenance", RELEASE_ENV, fake.io);

    const recordPath = `${RELEASE_PROVENANCE_DIR}/release-provenance-darwin-aarch64.json`;
    const parsed: unknown = JSON.parse(Buffer.from(fake.files.get(recordPath) ?? []).toString("utf8"));
    if (!isRecord(parsed) || !isRecord(parsed.artifact) || !isRecord(parsed.source) || !isRecord(parsed.workflow)) {
      throw new Error("release provenance record is missing expected fields");
    }
    expect(parsed.artifact.name).toBe(assetName);
    expect(parsed.artifact.sha256).toBe(sha256(artifactBytes));
    expect(parsed.source.commitSha).toBe(SOURCE_SHA);
    expect(parsed.source.tagTargetSha).toBe(SOURCE_SHA);
    expect(parsed.workflow.runUrl).toBe("https://github.example.test/fixture/ultra-rss-reader/actions/runs/123456");
    expect(fake.files.get(RELEASE_PROVENANCE_ASSETS_LIST)?.toString()).toBe(`${recordPath}\n`);
  });

  it("rejects provenance when the tag target SHA differs from the current source", () => {
    const fake = createFakeArtifactWorkflowIO();
    const tagTargetSha = "b".repeat(40);
    const assetName = "Ultra RSS Reader.app.tar.gz";
    const checksumAssetPath = `src-tauri/target/${assetName}.sha256`;
    const artifactBytes = Buffer.from("isolated release artifact\n");
    addFile(fake, "package.json", '{"type":"module","version":"1.2.3"}\n');
    addFile(fake, CHECKSUM_ASSETS_LIST, `${checksumAssetPath}\n`);
    addFile(fake, checksumAssetPath, `${sha256(artifactBytes)}  ${assetName}\n`);
    addFile(
      fake,
      DEPENDENCY_PROVENANCE_ASSETS_LIST,
      `${RELEASE_PROVENANCE_DIR}/pnpm-licenses-darwin-aarch64.json\n${RELEASE_PROVENANCE_DIR}/cargo-licenses-darwin-aarch64.json\n`,
    );
    fake.gitOutputs.set("rev-parse HEAD", SOURCE_SHA);
    fake.gitOutputs.set(`rev-parse refs/tags/${RELEASE_ENV.RELEASE_TAG}^{}`, tagTargetSha);
    fake.gitOutputs.set(`log -1 --format=%s ${SOURCE_SHA}`, "release fixture (#123)");

    expect(() => runArtifactWorkflow("generate-release-provenance", RELEASE_ENV, fake.io)).toThrow(
      `release provenance source ${SOURCE_SHA} does not match tag target ${tagTargetSha}`,
    );
  });

  it("uses the release signing commands and skips Gatekeeper without Apple notarization credentials", () => {
    const fake = createFakeArtifactWorkflowIO();
    const bundleRoot = "src-tauri/target/release/bundle";
    const appDirectory = path.join(bundleRoot, "macos", "Ultra RSS Reader.app");
    addDirectory(fake, bundleRoot, [{ isDirectory: true, name: "macos" }]);
    addDirectory(fake, path.join(bundleRoot, "macos"), [{ isDirectory: true, name: "Ultra RSS Reader.app" }]);
    addDirectory(fake, appDirectory);

    runArtifactWorkflow("validate-macos-app-signature", { RUNNER_OS: "macOS" }, fake.io);

    expect(fake.verifications).toEqual([
      {
        args: ["--verify", "--deep", "--strict", "--verbose=2", appDirectory],
        command: "codesign",
      },
    ]);
    expect(fake.logs).toContain(
      "Skipping Gatekeeper notarization assessment because Apple notarization credentials are not configured",
    );
  });

  it("runs the Gatekeeper assessment only when all Apple credential fields are configured", () => {
    const fake = createFakeArtifactWorkflowIO();
    const bundleRoot = "src-tauri/target/release/bundle";
    const appDirectory = path.join(bundleRoot, "macos", "Ultra RSS Reader.app");
    addDirectory(fake, bundleRoot, [{ isDirectory: true, name: "macos" }]);
    addDirectory(fake, path.join(bundleRoot, "macos"), [{ isDirectory: true, name: "Ultra RSS Reader.app" }]);
    addDirectory(fake, appDirectory);

    runArtifactWorkflow(
      "validate-macos-app-signature",
      {
        APPLE_ID: "dummy@example.invalid",
        APPLE_PASSWORD: "dummy-password",
        APPLE_SIGNING_IDENTITY: "dummy-signing-identity",
        APPLE_TEAM_ID: "DUMMYTEAM",
        RUNNER_OS: "macOS",
      },
      fake.io,
    );

    expect(fake.verifications).toEqual([
      {
        args: ["--verify", "--deep", "--strict", "--verbose=2", appDirectory],
        command: "codesign",
      },
      {
        args: ["--assess", "--type", "execute", "--verbose=4", appDirectory],
        command: "spctl",
      },
    ]);
  });

  it("reports missing app bundles, signature sidecars, and malformed release inventory", () => {
    const missingApp = createFakeArtifactWorkflowIO();
    const bundleRoot = "src-tauri/target/release/bundle";
    addDirectory(missingApp, bundleRoot);
    expect(() => runArtifactWorkflow("validate-macos-app-signature", { RUNNER_OS: "macOS" }, missingApp.io)).toThrow(
      "macOS release must produce exactly one .app bundle, found 0",
    );

    const missingSignature = createFakeArtifactWorkflowIO();
    const updaterDirectory = path.join(bundleRoot, "macos");
    const updaterPath = path.join(updaterDirectory, "Ultra.RSS.Reader_aarch64.app.tar.gz");
    addDirectory(missingSignature, bundleRoot, [{ isDirectory: true, name: "macos" }]);
    addDirectory(missingSignature, updaterDirectory, [{ isDirectory: false, name: path.basename(updaterPath) }]);
    addFile(missingSignature, updaterPath, "asset");
    expect(() => runArtifactWorkflow("validate-updater-assets", { RUNNER_OS: "macOS" }, missingSignature.io)).toThrow(
      `updater platform darwin-aarch64 is missing signature sidecar ${updaterPath}.sig`,
    );

    const malformedInventory = createFakeArtifactWorkflowIO();
    malformedInventory.releaseViews.push({
      status: 0,
      stderr: "",
      stdout: JSON.stringify({
        assets: [{ name: 4 }],
        isDraft: true,
        isPrerelease: false,
        tagName: "v1.2.3",
        url: "https://github.com/fixture/ultra-rss-reader/releases/tag/v1.2.3",
      }),
    });
    expect(() => runArtifactWorkflow("validate-existing-release-assets", RELEASE_ENV, malformedInventory.io)).toThrow(
      "gh release view returned invalid JSON",
    );
  });

  it("uploads exactly three release provenance assets and rejects any other total", () => {
    const tag = "v1.2.3";
    const dependencyAssets = [
      `${RELEASE_PROVENANCE_DIR}/pnpm-licenses-darwin-aarch64.json`,
      `${RELEASE_PROVENANCE_DIR}/cargo-licenses-darwin-aarch64.json`,
    ];
    const releaseAsset = `${RELEASE_PROVENANCE_DIR}/release-provenance-darwin-aarch64.json`;
    const valid = createFakeArtifactWorkflowIO();
    addFile(valid, DEPENDENCY_PROVENANCE_ASSETS_LIST, `${dependencyAssets.join("\n")}\n`);
    addFile(valid, RELEASE_PROVENANCE_ASSETS_LIST, `${releaseAsset}\n`);

    expect(
      expectProcessExit(() => runArtifactWorkflow("upload-release-provenance", { RELEASE_TAG: tag }, valid.io)),
    ).toBe(0);
    expect(valid.uploads).toEqual([{ assets: [...dependencyAssets, releaseAsset], tag }]);

    const invalid = createFakeArtifactWorkflowIO();
    addFile(invalid, DEPENDENCY_PROVENANCE_ASSETS_LIST, `${dependencyAssets.join("\n")}\n`);
    addFile(invalid, RELEASE_PROVENANCE_ASSETS_LIST, `${releaseAsset}\n${releaseAsset}.extra\n`);
    expect(() => runArtifactWorkflow("upload-release-provenance", { RELEASE_TAG: tag }, invalid.io)).toThrow(
      "expected three release provenance assets, found 4",
    );
    expect(invalid.events).toEqual([]);
  });

  it("rechecks release inventory after a failed clobber upload before exiting", () => {
    const fake = createFakeArtifactWorkflowIO();
    const tag = "v1.2.3";
    const checksumAsset = "tmp/Ultra RSS Reader.app.tar.gz.sha256";
    addFile(fake, CHECKSUM_ASSETS_LIST, `${checksumAsset}\n`);
    const releaseView = JSON.stringify({
      assets: [{ name: path.basename(checksumAsset) }],
      isDraft: true,
      isPrerelease: false,
      tagName: tag,
      url: `https://github.com/fixture/ultra-rss-reader/releases/tag/${tag}`,
    });
    fake.releaseViews.push(
      { status: 0, stderr: "", stdout: releaseView },
      { status: 0, stderr: "", stdout: releaseView },
    );
    fake.uploadResults.push({ status: 1 });

    expect(
      expectProcessExit(() => runArtifactWorkflow("upload-updater-checksums", { RELEASE_TAG: tag }, fake.io)),
    ).toBe(1);

    expect(fake.events).toEqual([`view:${tag}`, `upload:${tag}`, `view:${tag}`]);
    expect(fake.uploads).toEqual([{ assets: [checksumAsset], tag }]);
    expect(fake.logs[0]).toContain("clobber_targets=Ultra RSS Reader.app.tar.gz.sha256");
    expect(fake.logs[1]).toContain("checksum upload failure recovery");
  });
});
