import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { z } from "zod";
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
  "core:window:allow-center",
  "core:window:allow-is-fullscreen",
  "core:window:allow-set-always-on-top",
  "core:window:allow-set-badge-count",
  "core:window:allow-set-fullscreen",
  "core:window:allow-set-icon",
  "core:window:allow-set-size",
  "core:window:allow-unmaximize",
] as const;

type CapabilityPermission =
  | string
  | {
      identifier: string;
      allow?: Array<{ url: string }>;
      deny?: Array<{ url: string }>;
    };

const TauriCapabilityContractSchema = z.object({
  identifier: z.string().optional(),
  permissions: z.array(
    z.union([
      z.string(),
      z.object({
        identifier: z.string(),
        allow: z.array(z.object({ url: z.string() })).optional(),
        deny: z.array(z.object({ url: z.string() })).optional(),
      }),
    ]),
  ),
});
type TauriCapability = z.output<typeof TauriCapabilityContractSchema>;
const TauriCapabilityFileSchema = z.union([TauriCapabilityContractSchema, z.array(TauriCapabilityContractSchema)]);

function permissionIdentifier(permission: CapabilityPermission): string {
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

  it("keeps browser-mode fallback independent from the global Tauri runtime object", () => {
    const config = readTauriConfig();

    expect(config.app?.withGlobalTauri).toBe(false);
  });
});
