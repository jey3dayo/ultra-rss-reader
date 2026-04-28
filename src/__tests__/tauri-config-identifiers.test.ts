import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readConfig(path: string): {
  productName?: string;
  identifier?: string;
  build?: {
    beforeDevCommand?: string;
    devUrl?: string;
    beforeBuildCommand?: string;
    frontendDist?: string;
  };
  app?: {
    windows?: Array<{
      title?: string;
    }>;
  };
} {
  return JSON.parse(readFileSync(resolve(process.cwd(), path), "utf8")) as {
    productName?: string;
    identifier?: string;
    build?: {
      beforeDevCommand?: string;
      devUrl?: string;
      beforeBuildCommand?: string;
      frontendDist?: string;
    };
    app?: {
      windows?: Array<{
        title?: string;
      }>;
    };
  };
}

describe("Tauri bundle identifiers", () => {
  it("keeps packaged builds on the production data directory", () => {
    expect(readConfig("src-tauri/tauri.conf.json").identifier).toBe("com.jey3dayo.ultra-rss-reader");
    expect(readConfig("src-tauri/tauri.release.conf.json").identifier).toBe("com.jey3dayo.ultra-rss-reader");
  });

  it("uses a separate identifier only for dev-mode runs", () => {
    const devConfig = readConfig("src-tauri/tauri.dev.conf.json");

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
