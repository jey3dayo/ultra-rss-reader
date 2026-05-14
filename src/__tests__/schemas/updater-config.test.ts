import { expect, test } from "vitest";
import {
  type TauriReleaseConfig,
  TauriReleaseConfigSchema,
  type TauriUpdaterConfig,
  TauriUpdaterConfigSchema,
} from "@/schemas/app-config";
import { parseJsonWithSchema } from "@/schemas/parse";
import releaseWorkflowSource from "../../../.github/workflows/release.yml?raw";
import releaseContaminationCheckerSource from "../../../scripts/check-release-build-contamination.ts?raw";
import releaseArtifactsSource from "../../../scripts/release/artifacts.ts?raw";
import releaseSourceValidatorSource from "../../../scripts/release/validate-source.ts?raw";
import releaseVersionValidatorSource from "../../../scripts/release/validate-version-parity.ts?raw";
import tauriConfigSource from "../../../src-tauri/tauri.conf.json?raw";
import tauriReleaseConfigSource from "../../../src-tauri/tauri.release.conf.json?raw";

const latestUpdaterUrl = "https://github.com/jey3dayo/ultra-rss-reader/releases/latest/download/latest.json";
const productionIdentifier = "com.jey3dayo.ultra-rss-reader";
const releaseTauriConfigPath = "src-tauri/tauri.release.conf.json";
const devTauriConfigPath = "src-tauri/tauri.dev.conf.json";
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
  expect(config.bundle.macOS?.signingIdentity).toBe("-");
});

test("release workflow exports updater signing secrets", async () => {
  const workflow = releaseWorkflowSource;
  const tauriActionBlock = extractStepBlock(workflow, "uses: tauri-apps/tauri-action@");
  const releaseConfig = readTauriReleaseConfig();

  expect(tauriActionBlock).toMatch(/^\s+env:\s*$/m);
  expect(tauriActionBlock).toContain("TAURI_SIGNING_PRIVATE_KEY:");
  expect(tauriActionBlock).toContain("TAURI_SIGNING_PRIVATE_KEY_PASSWORD:");
  expect(tauriActionBlock).not.toContain("APPLE_SIGNING_IDENTITY:");
  expect(tauriActionBlock).not.toContain("APPLE_ID:");
  expect(tauriActionBlock).not.toContain("APPLE_PASSWORD:");
  expect(tauriActionBlock).not.toContain("APPLE_TEAM_ID:");
  expect(workflow).toContain("Import Apple signing certificate");
  expect(workflow).toContain("building macOS artifacts with ad-hoc signing");
  expect(workflow).not.toContain('missing+=("APPLE_CERTIFICATE")');
  expect(workflow).not.toContain('missing+=("APPLE_SIGNING_IDENTITY")');
  expect(releaseConfig.bundle.createUpdaterArtifacts).toBe(true);
  expect(releaseConfig.bundle.macOS?.signingIdentity).toBe("-");
  expect(tauriActionBlock).toContain(`--config ${releaseTauriConfigPath}`);
  expect(tauriActionBlock).not.toContain(`--config ${devTauriConfigPath}`);
  expect(releaseVersionValidatorSource).toContain(`const RELEASE_TAURI_CONFIG_PATH = "${releaseTauriConfigPath}";`);
  expect(releaseVersionValidatorSource).toContain(`const DEV_TAURI_CONFIG_PATH = "${devTauriConfigPath}";`);
});

test("release workflow keeps the supported artifact matrix", async () => {
  const workflow = releaseWorkflowSource;

  expect(workflow).toContain("platform: macos-latest");
  expect(workflow).toContain("args: --target aarch64-apple-darwin");
  expect(workflow).toContain("platform: windows-latest");
  expect(workflow).toMatch(/args:\s*""/);
  expect(workflow).toContain("releaseDraft: $" + "{{ steps.release-policy.outputs.draft }}");
});

test("release workflow maps updater manifest platforms to asset signatures and checksums", async () => {
  const workflow = releaseWorkflowSource;

  expect(workflow).toContain("Validate updater manifest asset contract");
  expect(workflow).toContain("Validate macOS app signing");
  expect(workflow).toContain("Generate updater asset checksums");
  expect(workflow).toContain("Upload updater asset checksums");
  expect(releaseArtifactsSource).toContain("validate-macos-app-signature");
  expect(releaseArtifactsSource).toContain('"codesign", ["--verify", "--deep", "--strict", "--verbose=2", appBundle]');
  expect(releaseArtifactsSource).toContain("Skipping Gatekeeper notarization assessment");
  expect(releaseArtifactsSource).toContain("hasNotarizationCredentials");
  expect(releaseArtifactsSource).toContain('"spctl", ["--assess", "--type", "execute", "--verbose=4", appBundle]');
  expect(releaseArtifactsSource).toContain('UNSUPPORTED_UPDATER_PLATFORM_KEYS = ["linux-x86_64", "linux-aarch64"]');

  for (const contract of releaseUpdaterAssetContract) {
    const matrixArgsLiteral = contract.matrixArgs === '""' ? "'\"\"'" : JSON.stringify(contract.matrixArgs);
    expect(releaseArtifactsSource).toContain(`platformKey: "${contract.platformKey}"`);
    expect(releaseArtifactsSource).toContain(`matrixPlatform: "${contract.matrixPlatform}"`);
    expect(releaseArtifactsSource).toContain(`matrixArgs: ${matrixArgsLiteral}`);
    expect(releaseArtifactsSource).toContain(`assetPattern: "${contract.assetPattern}"`);
    expect(releaseArtifactsSource).toContain(`signaturePattern: "${contract.signaturePattern}"`);
    expect(releaseArtifactsSource).toContain(`checksumPattern: "${contract.checksumPattern}"`);
    expect(workflow).toContain(`platform: ${contract.matrixPlatform}`);
    expect(workflow).toContain(`args: ${contract.matrixArgs}`);
  }
});

test("release workflow keeps provenance and dev-only contamination gates before artifact upload", async () => {
  const workflow = releaseWorkflowSource;

  expect(workflow).toContain("Validate release source");
  expect(workflow).toContain("Validate release build contamination contract");
  expect(releaseSourceValidatorSource).toContain("const tagTargetSha = git");
  expect(releaseSourceValidatorSource).toContain("const checkoutSha = git");
  expect(releaseContaminationCheckerSource).toContain(
    "release capability must not include debug-only MCP bridge permissions",
  );
  expect(workflow.indexOf("Generate updater asset checksums")).toBeLessThan(
    workflow.indexOf("Upload updater asset checksums"),
  );
  expect(workflow.indexOf("Validate release build contamination contract")).toBeLessThan(
    workflow.indexOf("tauri-apps/tauri-action"),
  );
  expect(workflow.indexOf("tauri-apps/tauri-action")).toBeLessThan(workflow.indexOf("Validate macOS app signing"));
  expect(workflow.indexOf("Validate macOS app signing")).toBeLessThan(
    workflow.indexOf("Validate updater manifest asset contract"),
  );
});
