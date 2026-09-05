import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { type TauriConfig, TauriConfigSchema } from "@/schemas/app-config";
import { parseJsonWithSchema } from "@/schemas/parse";

const OFFICIAL_TAURI_V2_CONFIG_SCHEMA_URL = "https://schema.tauri.app/config/2";
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

    expect(baseConfig.$schema).toBe(OFFICIAL_TAURI_V2_CONFIG_SCHEMA_URL);
    expect(DISALLOWED_TAURI_CONFIG_SCHEMA_URLS).not.toContain(baseConfig.$schema);
  });

  it("keeps packaged builds on the production data directory", () => {
    const baseConfig = readConfig("src-tauri/tauri.conf.json");

    expect(baseConfig.identifier).toBe("com.jey3dayo.ultra-rss-reader");
    expect(baseConfig.productName).toBe("Ultra RSS Reader");
    expect(baseConfig.app?.windows?.[0]?.title).toBe("");
    expect(readConfig("src-tauri/tauri.release.conf.json").identifier).toBe("com.jey3dayo.ultra-rss-reader");
  });

  it("uses a separate identifier only for dev-mode runs", () => {
    const devConfig = readConfig("src-tauri/tauri.dev.conf.json");
    const baseConfig = readConfig("src-tauri/tauri.conf.json");

    expect(devConfig.identifier).not.toBe(baseConfig.identifier);
    expect(devConfig.identifier).toBe("com.ultra-rss-reader.dev");
    expect(devConfig.productName).toBe("Ultra RSS Reader Dev");
    expect(devConfig.app?.windows?.[0]?.title).toBe(" ");
  });

  it("keeps the dev overlay config pointed at the Vite dev server", () => {
    expect(readConfig("src-tauri/tauri.dev.conf.json").build).toMatchObject({
      beforeDevCommand: "pnpm run dev:tauri:vite",
      devUrl: "http://127.0.0.1:1420",
      beforeBuildCommand: "pnpm exec tsc && pnpm exec vite build",
      frontendDist: "../dist",
    });
  });
});
