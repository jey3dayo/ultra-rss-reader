import { expect, test } from "vitest";
import {
  type TauriReleaseConfig,
  TauriReleaseConfigSchema,
  type TauriUpdaterConfig,
  TauriUpdaterConfigSchema,
} from "@/schemas/app-config";
import { parseJsonWithSchema } from "@/schemas/parse";
import releaseWorkflowSource from "../../../.github/workflows/release.yml?raw";
import tauriConfigSource from "../../../src-tauri/tauri.conf.json?raw";
import tauriReleaseConfigSource from "../../../src-tauri/tauri.release.conf.json?raw";

const latestUpdaterUrl = "https://github.com/jey3dayo/ultra-rss-reader/releases/latest/download/latest.json";
const productionIdentifier = "com.jey3dayo.ultra-rss-reader";
const releaseUpdaterAssetContract = [
  {
    assetPattern: ".app.tar.gz",
    checksumPattern: ".app.tar.gz.sha256",
    matrixArgs: "--target aarch64-apple-darwin",
    matrixPlatform: "macos-latest",
    platformKey: "darwin-aarch64",
    signaturePattern: ".app.tar.gz.sig",
  },
  {
    assetPattern: "-setup.exe",
    checksumPattern: "-setup.exe.sha256",
    matrixArgs: '""',
    matrixPlatform: "windows-latest",
    platformKey: "windows-x86_64",
    signaturePattern: "-setup.exe.sig",
  },
] as const;

function readTauriUpdaterConfig(): TauriUpdaterConfig {
  return parseJsonWithSchema(tauriConfigSource, TauriUpdaterConfigSchema);
}

function readTauriReleaseConfig(): TauriReleaseConfig {
  return parseJsonWithSchema(tauriReleaseConfigSource, TauriReleaseConfigSchema);
}

function extractStepBlock(workflow: string, marker: string): string {
  const lines = workflow.split("\n");
  const startIndex = lines.findIndex((line) => line.includes(marker));

  expect(startIndex).toBeGreaterThanOrEqual(0);
  if (startIndex < 0) {
    return "";
  }

  const blockLines = [lines[startIndex]];
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (/^\s{6}-\s/.test(line)) {
      break;
    }

    blockLines.push(line);
  }

  return blockLines.join("\n");
}

test("updater config points to GitHub Releases latest.json and has a pubkey", async () => {
  const config = readTauriUpdaterConfig();
  const { endpoints, pubkey } = config.plugins.updater;

  expect(endpoints).toHaveLength(1);
  expect(endpoints[0]).toBe(latestUpdaterUrl);
  expect(endpoints).toContain(latestUpdaterUrl);
  expect(new URL(endpoints[0] ?? "").protocol).toBe("https:");
  expect(pubkey.trim()).not.toBe("");
});

test("base config keeps updater artifacts disabled outside release builds", async () => {
  const config = readTauriUpdaterConfig();

  expect(config.bundle?.createUpdaterArtifacts).toBe(false);
});

test("release config overrides identifier and enables updater artifacts", async () => {
  const config = readTauriReleaseConfig();

  expect(config.identifier).toBe(productionIdentifier);
  expect(config.bundle.createUpdaterArtifacts).toBe(true);
});

test("release workflow exports updater signing secrets", async () => {
  const workflow = releaseWorkflowSource;
  const tauriActionBlock = extractStepBlock(workflow, "uses: tauri-apps/tauri-action@");
  const releaseConfig = readTauriReleaseConfig();

  expect(tauriActionBlock).toMatch(/^\s+env:\s*$/m);
  expect(tauriActionBlock).toContain("TAURI_SIGNING_PRIVATE_KEY:");
  expect(tauriActionBlock).toContain("TAURI_SIGNING_PRIVATE_KEY_PASSWORD:");
  expect(releaseConfig.bundle.createUpdaterArtifacts).toBe(true);
  expect(tauriActionBlock).toContain("--config src-tauri/tauri.release.conf.json");
});

test("release workflow keeps the supported artifact matrix", async () => {
  const workflow = releaseWorkflowSource;

  expect(workflow).toContain("platform: macos-latest");
  expect(workflow).toContain("args: --target aarch64-apple-darwin");
  expect(workflow).toContain("platform: windows-latest");
  expect(workflow).toMatch(/args:\s*""/);
  expect(workflow).toContain("releaseDraft: true");
});

test("release workflow maps updater manifest platforms to asset signatures and checksums", async () => {
  const workflow = releaseWorkflowSource;

  expect(workflow).toContain("Validate updater manifest asset contract");
  expect(workflow).toContain("Generate updater asset checksums");
  expect(workflow).toContain("Upload updater asset checksums");
  expect(workflow).toContain('unsupportedUpdaterPlatformKeys = ["linux-x86_64", "linux-aarch64"]');

  for (const contract of releaseUpdaterAssetContract) {
    expect(workflow).toContain(`platformKey: "${contract.platformKey}"`);
    expect(workflow).toContain(`matrixPlatform: "${contract.matrixPlatform}"`);
    expect(workflow).toContain(`matrixArgs: ${JSON.stringify(contract.matrixArgs)}`);
    expect(workflow).toContain(`assetPattern: "${contract.assetPattern}"`);
    expect(workflow).toContain(`signaturePattern: "${contract.signaturePattern}"`);
    expect(workflow).toContain(`checksumPattern: "${contract.checksumPattern}"`);
    expect(workflow).toContain(`platform: ${contract.matrixPlatform}`);
    expect(workflow).toContain(`args: ${contract.matrixArgs}`);
  }
});

test("release workflow keeps provenance and dev-only contamination gates before artifact upload", async () => {
  const workflow = releaseWorkflowSource;

  expect(workflow).toContain("Validate release source");
  expect(workflow).toContain("Validate release build contamination contract");
  expect(workflow).toContain("tag_target_sha");
  expect(workflow).toContain("checkout_sha");
  expect(workflow).toContain("release capability must not include debug-only MCP bridge permissions");
  expect(workflow.indexOf("Generate updater asset checksums")).toBeLessThan(
    workflow.indexOf("Upload updater asset checksums"),
  );
  expect(workflow.indexOf("Validate release build contamination contract")).toBeLessThan(
    workflow.indexOf("tauri-apps/tauri-action"),
  );
});
