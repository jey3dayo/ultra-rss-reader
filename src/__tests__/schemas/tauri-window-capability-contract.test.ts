import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { type TauriCapability, TauriCapabilitySchema } from "@/schemas/app-config";
import { parseJsonWithSchema } from "@/schemas/parse";

type TauriConfig = {
  app?: {
    withGlobalTauri?: boolean;
  };
};

const expectedMainWebviewPermissions = [
  "core:default",
  "opener:allow-default-urls",
  "opener:allow-open-url",
  "clipboard-manager:allow-write-text",
  "core:window:allow-center",
  "core:window:allow-is-fullscreen",
  "core:window:allow-set-always-on-top",
  "core:window:allow-set-badge-count",
  "core:window:allow-set-fullscreen",
  "core:window:allow-set-icon",
  "core:window:allow-set-size",
  "core:window:allow-unmaximize",
] as const;

function readDefaultCapability(): TauriCapability {
  const currentFile = fileURLToPath(import.meta.url);
  const currentDir = path.dirname(currentFile);
  const capabilityPath = path.resolve(currentDir, "../../../src-tauri/capabilities/default.json");
  return parseJsonWithSchema(readFileSync(capabilityPath, "utf8"), TauriCapabilitySchema);
}

function readTauriConfig(): TauriConfig {
  const currentFile = fileURLToPath(import.meta.url);
  const currentDir = path.dirname(currentFile);
  const configPath = path.resolve(currentDir, "../../../src-tauri/tauri.conf.json");
  return JSON.parse(readFileSync(configPath, "utf8")) as TauriConfig;
}

describe("tauri window capability contract", () => {
  it("keeps the main webview permission matrix minimal and feature-backed", () => {
    const capability = readDefaultCapability();

    expect(capability.permissions).toEqual(expectedMainWebviewPermissions);
    expect(capability.permissions).not.toContain("opener:default");
    expect(capability.permissions).not.toContain("opener:allow-open-path");
    expect(capability.permissions).not.toContain("opener:allow-reveal-item-in-dir");
    expect(capability.permissions).not.toContain("updater:default");
  });

  it("does not ship debug-only MCP bridge permissions in the default release capability", () => {
    const capability = readDefaultCapability();

    expect(capability.permissions.filter((permission) => permission.startsWith("mcp-bridge:"))).toEqual([]);
  });

  it("keeps browser-mode fallback independent from the global Tauri runtime object", () => {
    const config = readTauriConfig();

    expect(config.app?.withGlobalTauri).toBe(false);
  });
});
