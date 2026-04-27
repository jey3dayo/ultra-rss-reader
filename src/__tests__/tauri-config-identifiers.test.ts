import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readConfig(path: string): {
  identifier?: string;
  build?: {
    beforeDevCommand?: string;
    devUrl?: string;
    beforeBuildCommand?: string;
    frontendDist?: string;
  };
} {
  return JSON.parse(readFileSync(resolve(process.cwd(), path), "utf8")) as {
    identifier?: string;
    build?: {
      beforeDevCommand?: string;
      devUrl?: string;
      beforeBuildCommand?: string;
      frontendDist?: string;
    };
  };
}

describe("Tauri bundle identifiers", () => {
  it("keeps packaged builds on the production data directory", () => {
    expect(readConfig("src-tauri/tauri.conf.json").identifier).toBe("com.jey3dayo.ultra-rss-reader");
    expect(readConfig("src-tauri/tauri.release.conf.json").identifier).toBe("com.jey3dayo.ultra-rss-reader");
  });

  it("uses a separate identifier only for dev-mode runs", () => {
    expect(readConfig("src-tauri/tauri.dev.conf.json").identifier).toBe("com.ultra-rss-reader.dev");
  });

  it("keeps the dev overlay config pointed at the Vite dev server", () => {
    expect(readConfig("src-tauri/tauri.dev.conf.json").build).toMatchObject({
      beforeDevCommand: "pnpm run dev:tauri:vite",
      devUrl: "http://localhost:1420",
      beforeBuildCommand: "pnpm exec tsc && pnpm exec vite build",
      frontendDist: "../dist",
    });
  });
});
