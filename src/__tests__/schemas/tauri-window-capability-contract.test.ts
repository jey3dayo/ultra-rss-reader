import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { extractRegisteredRustCommandNames } from "@tests/helpers/tauri-command-contract";
import { describe, expect, it } from "vitest";
import { type TauriCapability, TauriCapabilityFileSchema } from "@/schemas/app-config";
import { parseJsonWithSchema } from "@/schemas/parse";

type TauriConfig = {
  app?: {
    withGlobalTauri?: boolean;
  };
};

const expectedMainWebviewPermissions = [
  "core:default",
  "opener:allow-open-url",
  "clipboard-manager:allow-write-text",
  "dialog:allow-save",
  "core:window:allow-center",
  "core:window:allow-is-fullscreen",
  "core:window:allow-set-always-on-top",
  "core:window:allow-set-badge-count",
  "core:window:allow-set-fullscreen",
  "core:window:allow-set-icon",
  "core:window:allow-set-size",
  "core:window:allow-start-dragging",
  "core:window:allow-unmaximize",
  "reader-commands",
  "browser-commands",
  "settings-commands",
  "debug-log-commands",
  "database-commands",
  "updater-commands",
  "share-commands",
] as const;

function permissionIdentifier(permission: TauriCapability["permissions"][number]): string {
  return typeof permission === "string" ? permission : permission.identifier;
}

function readDefaultCapability(identifier = "main"): TauriCapability {
  const currentFile = fileURLToPath(import.meta.url);
  const currentDir = path.dirname(currentFile);
  const capabilityPath = path.resolve(currentDir, "../../../src-tauri/capabilities/default.json");
  const capabilityFile = parseJsonWithSchema(readFileSync(capabilityPath, "utf8"), TauriCapabilityFileSchema);
  if (!Array.isArray(capabilityFile)) {
    return capabilityFile;
  }
  const capability = capabilityFile.find((entry) => entry.identifier === identifier);
  if (!capability) {
    throw new Error(`Missing Tauri capability: ${identifier}`);
  }
  return capability;
}

function readTauriConfig(): TauriConfig {
  const currentFile = fileURLToPath(import.meta.url);
  const currentDir = path.dirname(currentFile);
  const configPath = path.resolve(currentDir, "../../../src-tauri/tauri.conf.json");
  return JSON.parse(readFileSync(configPath, "utf8")) as TauriConfig;
}

function readWorkspaceFile(relativePath: string): string {
  const currentFile = fileURLToPath(import.meta.url);
  const currentDir = path.dirname(currentFile);
  return readFileSync(path.resolve(currentDir, "../../..", relativePath), "utf8");
}

function readWorkspaceDir(relativePath: string): string[] {
  const currentFile = fileURLToPath(import.meta.url);
  const currentDir = path.dirname(currentFile);
  return readdirSync(path.resolve(currentDir, "../../..", relativePath)).toSorted();
}

function extractPermissionAllowlist(source: string): {
  identifier: string;
  commands: string[];
} {
  const identifier = source.match(/identifier\s*=\s*"([^"]+)"/)?.[1];
  const allowBlock = source.match(/commands\.allow\s*=\s*\[([\s\S]*?)\]/)?.[1] ?? "";
  if (!identifier) {
    throw new Error("Missing permission identifier");
  }
  return {
    identifier,
    commands: [...allowBlock.matchAll(/"([^"]+)"/g)]
      .map((match) => match[1])
      .filter((command): command is string => Boolean(command)),
  };
}

describe("tauri window capability contract", () => {
  it("keeps the main webview permission matrix minimal and feature-backed", () => {
    const capability = readDefaultCapability();

    const permissionIds = capability.permissions.map(permissionIdentifier);

    expect(permissionIds).toEqual(expectedMainWebviewPermissions);
    expect(permissionIds).not.toContain("opener:default");
    expect(permissionIds).not.toContain("opener:allow-default-urls");
    expect(permissionIds).not.toContain("opener:allow-open-path");
    expect(permissionIds).not.toContain("opener:allow-reveal-item-in-dir");
    expect(permissionIds).not.toContain("updater:default");
    expect(capability.permissions).toContainEqual({
      identifier: "opener:allow-open-url",
      allow: [{ url: "http://*" }, { url: "https://*" }, { url: "mailto:*" }],
    });
  });

  it("does not ship debug-only MCP bridge permissions in the default release capability", () => {
    const capability = readDefaultCapability();

    expect(
      capability.permissions.map(permissionIdentifier).filter((permission) => permission.startsWith("mcp-bridge:")),
    ).toEqual([]);
  });

  it("keeps the embedded browser webview capability event-only", () => {
    const capability = readDefaultCapability("browser-webview");

    expect(capability.webviews).toEqual(["browser-webview"]);
    expect(capability.permissions.map(permissionIdentifier)).toEqual(["core:event:default"]);
  });

  it("keeps release plugin permissions backed by runtime plugin initialization", () => {
    const permissionIds = readDefaultCapability().permissions.map(permissionIdentifier);
    const tauriLib = readWorkspaceFile("src-tauri/src/lib.rs");

    expect(permissionIds).toEqual(
      expect.arrayContaining([
        "opener:allow-open-url",
        "clipboard-manager:allow-write-text",
        "dialog:allow-save",
        "updater-commands",
      ]),
    );
    expect(tauriLib).toContain("tauri_plugin_clipboard_manager::init()");
    expect(tauriLib).toContain("tauri_plugin_dialog::init()");
    expect(tauriLib).toContain("tauri_plugin_opener::init()");
    expect(tauriLib).toContain("tauri_plugin_updater::Builder::new().build()");
  });

  it("keeps Tauri command permissions split by command ownership", () => {
    const mainCapability = readDefaultCapability();
    const permissionIds = mainCapability.permissions.map(permissionIdentifier);
    const permissionFiles = readWorkspaceDir("src-tauri/permissions");
    const permissionAllowlists = Object.fromEntries(
      permissionFiles.map((fileName) => {
        const permission = extractPermissionAllowlist(readWorkspaceFile(`src-tauri/permissions/${fileName}`));
        return [permission.identifier, permission.commands];
      }),
    );
    const allowedCommands = Object.values(permissionAllowlists).flat();
    const registeredCommands = extractRegisteredRustCommandNames(readWorkspaceFile("src-tauri/src/lib.rs"));

    expect(permissionFiles).toEqual([
      "browser-commands.toml",
      "database-commands.toml",
      "debug-log-commands.toml",
      "reader-commands.toml",
      "settings-commands.toml",
      "share-commands.toml",
      "updater-commands.toml",
    ]);
    expect(permissionIds).toEqual(expect.arrayContaining(Object.keys(permissionAllowlists)));
    expect(allowedCommands.toSorted()).toEqual(registeredCommands.toSorted());
    expect(new Set(allowedCommands).size).toBe(allowedCommands.length);
  });

  it("keeps browser-mode fallback independent from the global Tauri runtime object", () => {
    const config = readTauriConfig();

    expect(config.app?.withGlobalTauri).toBe(false);
  });
});
