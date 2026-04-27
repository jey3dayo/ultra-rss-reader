import { describe, expect, it } from "vitest";
import {
  buildLocalTauriSpawnSpec,
  buildWslTauriSpawnSpec,
  isWslEnvironment,
  pickWindowsEnvOverrides,
  removeStaleMacosDevBundle,
  shouldCleanStaleMacosDevBundle,
} from "../../../scripts/tauri-cli-dispatch.mjs";

function normalizePathSeparators(value: string) {
  return value.replaceAll("\\", "/");
}

describe("isWslEnvironment", () => {
  it("detects WSL via WSL_INTEROP", () => {
    expect(
      isWslEnvironment({
        platform: "linux",
        env: { WSL_INTEROP: "/run/WSL/123_interop" },
        osRelease: "6.6.87.2-microsoft-standard-WSL2",
      }),
    ).toBe(true);
  });

  it("does not treat native Windows as WSL", () => {
    expect(
      isWslEnvironment({
        platform: "win32",
        env: {},
        osRelease: "10.0.26100",
      }),
    ).toBe(false);
  });
});

describe("pickWindowsEnvOverrides", () => {
  it("forwards app-dev specific environment variables only", () => {
    expect(
      pickWindowsEnvOverrides({
        DEV_CREDENTIALS: "1",
        VITE_DEV_INTENT: "open-subscriptions-index",
        RUST_LOG: "info",
        PATH: "/usr/bin",
        HOME: "/home/dev",
      }),
    ).toEqual({
      DEV_CREDENTIALS: "1",
      VITE_DEV_INTENT: "open-subscriptions-index",
      RUST_LOG: "info",
    });
  });
});

describe("buildLocalTauriSpawnSpec", () => {
  it("spawns the local Tauri CLI through pnpm", () => {
    const spawnSpec = buildLocalTauriSpawnSpec(
      ["dev", "-c", "src-tauri/tauri.dev.conf.json"],
      "file:///C:/repo/scripts/tauri-cli-dispatch.mjs",
    );

    expect(spawnSpec.command).toBe("pnpm");
    expect(spawnSpec.args).toEqual(["exec", "tauri", "dev", "-c", "src-tauri/tauri.dev.conf.json"]);
  });
});

describe("shouldCleanStaleMacosDevBundle", () => {
  it("cleans only dev runs that use the dev overlay config", () => {
    expect(shouldCleanStaleMacosDevBundle(["dev", "-c", "src-tauri/tauri.dev.conf.json"])).toBe(true);
    expect(shouldCleanStaleMacosDevBundle(["build", "-c", "src-tauri/tauri.dev.conf.json"])).toBe(false);
    expect(shouldCleanStaleMacosDevBundle(["dev", "-c", "src-tauri/tauri.conf.json"])).toBe(false);
  });
});

describe("removeStaleMacosDevBundle", () => {
  it("removes a stale macOS dev bundle artifact with the dev bundle identifier", async () => {
    const removedPaths: string[] = [];

    const removed = await removeStaleMacosDevBundle({
      cwd: "/repo",
      platform: "darwin",
      readFileImpl: async (targetPath) => {
        const pathText = normalizePathSeparators(String(targetPath));
        if (pathText.includes("/debug/bundle/") || pathText.includes("/release/bundle/")) {
          return `<?xml version="1.0"?><plist><dict><key>CFBundleIdentifier</key><string>com.ultra-rss-reader.dev</string></dict></plist>`;
        }
        throw new Error(`unexpected path: ${pathText}`);
      },
      rmImpl: async (targetPath) => {
        removedPaths.push(normalizePathSeparators(String(targetPath)));
      },
    });

    expect(removed).toBe(true);
    expect(removedPaths).toEqual([
      "/repo/src-tauri/target/debug/bundle/macos/Ultra RSS Reader.app",
      "/repo/src-tauri/target/release/bundle/macos/Ultra RSS Reader.app",
    ]);
  });

  it("keeps non-dev bundles intact", async () => {
    const removedPaths: string[] = [];

    const removed = await removeStaleMacosDevBundle({
      cwd: "/repo",
      platform: "darwin",
      readFileImpl: async () =>
        `<?xml version="1.0"?><plist><dict><key>CFBundleIdentifier</key><string>com.jey3dayo.ultra-rss-reader</string></dict></plist>`,
      rmImpl: async (targetPath) => {
        removedPaths.push(normalizePathSeparators(String(targetPath)));
      },
    });

    expect(removed).toBe(false);
    expect(removedPaths).toEqual([]);
  });
});

describe("buildWslTauriSpawnSpec", () => {
  it("dispatches Tauri through Windows PowerShell from a WSL shell", () => {
    const spawnSpec = buildWslTauriSpawnSpec(["dev", "-c", "src-tauri/tauri.dev.conf.json"], "C:\\repo", {
      DEV_CREDENTIALS: "1",
      VITE_DEV_INTENT: "open-feed-cleanup",
    });

    expect(spawnSpec.command).toBe("sh");
    expect(spawnSpec.args[0]).toBe("-lc");
    expect(spawnSpec.args[1]).toContain(
      "powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -OutputFormat Text -EncodedCommand ",
    );
    expect(spawnSpec.args[1]).not.toContain("open-feed-cleanup");

    const encodedCommand = spawnSpec.args[1].split(" -EncodedCommand ")[1];
    const powerShellScript = Buffer.from(encodedCommand, "base64").toString("utf16le");
    expect(powerShellScript).toContain("$ProgressPreference = 'SilentlyContinue'");
    expect(powerShellScript).toContain("[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()");
    expect(powerShellScript).toContain("$env:HOME = $env:USERPROFILE");
    expect(powerShellScript).toContain("[Environment]::GetEnvironmentVariable('Path', 'Machine')");
    expect(powerShellScript).toContain("& pnpm exec tauri");
  });
});
