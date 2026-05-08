import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { type TauriConfig, TauriConfigSchema } from "@/schemas/app-config";
import { parseJsonWithSchema } from "@/schemas/parse";

function readConfig(path: string): TauriConfig {
  return parseJsonWithSchema(
    readFileSync(resolve(process.cwd(), path), "utf8"),
    TauriConfigSchema,
  );
}

describe("Tauri bundle identifiers", () => {
  it("keeps packaged builds on the production data directory", () => {
    const baseConfig = readConfig("src-tauri/tauri.conf.json");

    expect(baseConfig.identifier).toBe("com.jey3dayo.ultra-rss-reader");
    expect(baseConfig.productName).toBe("Ultra RSS Reader");
    expect(baseConfig.app?.windows?.[0]?.title).toBe("");
    expect(readConfig("src-tauri/tauri.release.conf.json").identifier).toBe(
      "com.jey3dayo.ultra-rss-reader",
    );
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
