import tauriConfigSource from "../src-tauri/tauri.conf.json?raw";
import releaseWorkflowSource from "../.github/workflows/release.yml?raw";
import { expect, test } from "vitest";

const latestUpdaterUrl = "https://github.com/jey3dayo/ultra-rss-reader/releases/latest/download/latest.json";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readJson(contents: string): unknown {
  return JSON.parse(contents);
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
  const config = readJson(tauriConfigSource);

  expect(isRecord(config)).toBe(true);
  if (!isRecord(config)) {
    return;
  }

  const plugins = config.plugins;
  expect(isRecord(plugins)).toBe(true);
  if (!isRecord(plugins)) {
    return;
  }

  const updater = plugins.updater;
  expect(isRecord(updater)).toBe(true);
  if (!isRecord(updater)) {
    return;
  }

  const endpoints = updater.endpoints;
  expect(Array.isArray(endpoints)).toBe(true);
  if (!Array.isArray(endpoints)) {
    return;
  }

  expect(endpoints[0]).toBe(latestUpdaterUrl);
  expect(endpoints).toContain(latestUpdaterUrl);
  expect(typeof updater.pubkey).toBe("string");
  if (typeof updater.pubkey !== "string") {
    return;
  }

  expect(updater.pubkey.trim()).not.toBe("");
});

test("release workflow exports updater signing secrets", async () => {
  const workflow = releaseWorkflowSource;
  const tauriActionBlock = extractStepBlock(workflow, "uses: tauri-apps/tauri-action@");

  expect(tauriActionBlock).toMatch(/^\s+env:\s*$/m);
  expect(tauriActionBlock).toContain("TAURI_SIGNING_PRIVATE_KEY:");
  expect(tauriActionBlock).toContain("TAURI_SIGNING_PRIVATE_KEY_PASSWORD:");
});
