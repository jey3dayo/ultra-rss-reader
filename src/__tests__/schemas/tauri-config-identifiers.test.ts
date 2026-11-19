import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { type TauriConfig, TauriConfigSchema } from "@/schemas/app-config";
import { parseJsonWithSchema } from "@/schemas/parse";

const DISALLOWED_TAURI_CONFIG_SCHEMA_URLS = [
  "https://schema.tauri.app/config/1",
  "https://schema.tauri.app/config/2.0.3",
  "https://raw.githubusercontent.com/tauri-apps/tauri/dev/tooling/cli/schema.json",
  "https://tauri.ubitools.com/config.schema.json",
] as const;

function readConfig(path: string): TauriConfig {
  return parseJsonWithSchema(readFileSync(resolve(process.cwd(), path), "utf8"), TauriConfigSchema);
}

describe("Tauri bundle identifiers", () => {
  it("uses the official Tauri v2 config schema", () => {
    const baseConfig = readConfig("src-tauri/tauri.conf.json");

    expect(DISALLOWED_TAURI_CONFIG_SCHEMA_URLS).not.toContain(baseConfig.$schema);
  });

  it("keeps packaged builds on the production data directory", () => {
    const baseConfig = readConfig("src-tauri/tauri.conf.json");

    expect(baseConfig.identifier).toBe("com.jey3dayo.ultra-rss-reader");
    expect(readConfig("src-tauri/tauri.release.conf.json").identifier).toBe("com.jey3dayo.ultra-rss-reader");
  });

  it("uses a separate identifier only for dev-mode runs", () => {
    const devConfig = readConfig("src-tauri/tauri.dev.conf.json");
    const baseConfig = readConfig("src-tauri/tauri.conf.json");

    expect(devConfig.identifier).not.toBe(baseConfig.identifier);
  });
});
