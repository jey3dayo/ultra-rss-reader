import { expect, test } from "vitest";
import { TauriReleaseConfigSchema, TauriUpdaterConfigSchema } from "@/schemas/app-config";
import { parseJsonWithSchema } from "@/schemas/parse";
import releaseWorkflowSource from "../../../.github/workflows/release.yml?raw";
import tauriConfigSource from "../../../src-tauri/tauri.conf.json?raw";
import tauriReleaseConfigSource from "../../../src-tauri/tauri.release.conf.json?raw";

const latestUpdaterUrl = "https://github.com/jey3dayo/ultra-rss-reader/releases/latest/download/latest.json";
const productionIdentifier = "com.jey3dayo.ultra-rss-reader";

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
  const config = parseJsonWithSchema(tauriConfigSource, TauriUpdaterConfigSchema);
  const { endpoints, pubkey } = config.plugins.updater;

  expect(endpoints[0]).toBe(latestUpdaterUrl);
  expect(endpoints).toContain(latestUpdaterUrl);
  expect(pubkey.trim()).not.toBe("");
});

test("release config overrides identifier and enables updater artifacts", async () => {
  const config = parseJsonWithSchema(tauriReleaseConfigSource, TauriReleaseConfigSchema);

  expect(config.identifier).toBe(productionIdentifier);
  expect(config.bundle.createUpdaterArtifacts).toBe(true);
});

test("release workflow exports updater signing secrets", async () => {
  const workflow = releaseWorkflowSource;
  const tauriActionBlock = extractStepBlock(workflow, "uses: tauri-apps/tauri-action@");

  expect(tauriActionBlock).toMatch(/^\s+env:\s*$/m);
  expect(tauriActionBlock).toContain("TAURI_SIGNING_PRIVATE_KEY:");
  expect(tauriActionBlock).toContain("TAURI_SIGNING_PRIVATE_KEY_PASSWORD:");
  expect(tauriActionBlock).toContain("--config src-tauri/tauri.release.conf.json");
});
