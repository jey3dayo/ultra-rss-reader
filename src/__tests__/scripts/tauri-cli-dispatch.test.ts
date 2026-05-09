import { describe, expect, it } from "vitest";
import {
  buildLocalTauriSpawnSpec,
  buildPnpmCommand,
  buildWslTauriSpawnSpec,
  hasMacosDevBundleIdentifierMarker,
  isWslEnvironment,
  pickWindowsEnvOverrides,
  removeStaleMacosDevBundle,
  shouldCleanStaleMacosDevBundle,
} from "../../../scripts/tauri-cli-dispatch.ts";

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
        VITE_DEV_WEB_URL: "https://example.com/debug",
        RUST_LOG: "info",
        TAURI_DEV_PORT: "1420",
        TAURI_SIGNING_PRIVATE_KEY: "secret-key",
        TAURI_SIGNING_PRIVATE_KEY_PASSWORD: "secret-password",
        VITE_API_TOKEN: "secret-token",
        RUST_REGISTRY_TOKEN: "secret-token",
        PATH: "/usr/bin",
        HOME: "/home/dev",
      }),
    ).toEqual({
      DEV_CREDENTIALS: "1",
      VITE_DEV_INTENT: "open-subscriptions-index",
      VITE_DEV_WEB_URL: "https://example.com/debug",
      RUST_LOG: "info",
      TAURI_DEV_PORT: "1420",
    });
  });
});

describe("buildLocalTauriSpawnSpec", () => {
  it("spawns the local Tauri CLI through pnpm", () => {
    const spawnSpec = buildLocalTauriSpawnSpec(
      ["dev", "-c", "src-tauri/tauri.dev.conf.json"],
      "file:///C:/repo/scripts/tauri-cli-dispatch.ts",
      "darwin",
    );

    expect(spawnSpec.command).toBe("pnpm");
    expect(spawnSpec.args).toEqual(["exec", "tauri", "dev", "-c", "src-tauri/tauri.dev.conf.json"]);
    expect(spawnSpec.shell).toBe(false);
  });

  it("uses the pnpm command shim on native Windows", () => {
    const spawnSpec = buildLocalTauriSpawnSpec(
      ["build", "--debug"],
      "file:///C:/repo/scripts/tauri-cli-dispatch.ts",
      "win32",
    );

    expect(spawnSpec.command).toBe("pnpm.cmd");
    expect(spawnSpec.args).toEqual(["exec", "tauri", "build", "--debug"]);
    expect(spawnSpec.shell).toBe(true);
  });

  it("keeps allowed and rejected command args unchanged outside Windows", () => {
    expect(buildLocalTauriSpawnSpec(["dev"], "file:///repo/scripts/tauri-cli-dispatch.ts", "darwin")).toMatchObject({
      command: "pnpm",
      args: ["exec", "tauri", "dev"],
      shell: false,
    });
    expect(
      buildLocalTauriSpawnSpec(["unknown-command"], "file:///repo/scripts/tauri-cli-dispatch.ts", "darwin"),
    ).toMatchObject({
      command: "pnpm",
      args: ["exec", "tauri", "unknown-command"],
      shell: false,
    });
  });

  it("keeps allowed and rejected command args unchanged on native Windows", () => {
    expect(buildLocalTauriSpawnSpec(["dev"], "file:///C:/repo/scripts/tauri-cli-dispatch.ts", "win32")).toMatchObject({
      command: "pnpm.cmd",
      args: ["exec", "tauri", "dev"],
      shell: true,
    });
    expect(
      buildLocalTauriSpawnSpec(["unknown-command"], "file:///C:/repo/scripts/tauri-cli-dispatch.ts", "win32"),
    ).toMatchObject({
      command: "pnpm.cmd",
      args: ["exec", "tauri", "unknown-command"],
      shell: true,
    });
  });
});

describe("buildPnpmCommand", () => {
  it("uses pnpm directly outside native Windows", () => {
    expect(buildPnpmCommand("darwin")).toBe("pnpm");
    expect(buildPnpmCommand("linux")).toBe("pnpm");
  });

  it("uses pnpm.cmd on native Windows", () => {
    expect(buildPnpmCommand("win32")).toBe("pnpm.cmd");
  });
});

describe("shouldCleanStaleMacosDevBundle", () => {
  it("cleans only dev runs that use the dev overlay config", () => {
    expect(shouldCleanStaleMacosDevBundle(["dev", "-c", "src-tauri/tauri.dev.conf.json"])).toBe(true);
    expect(shouldCleanStaleMacosDevBundle(["dev", "--config", "src-tauri/tauri.dev.conf.json"])).toBe(true);
    expect(shouldCleanStaleMacosDevBundle(["dev", "-c=src-tauri/tauri.dev.conf.json"])).toBe(true);
    expect(shouldCleanStaleMacosDevBundle(["dev", "--config=src-tauri/tauri.dev.conf.json"])).toBe(true);
    expect(shouldCleanStaleMacosDevBundle(["build", "-c", "src-tauri/tauri.dev.conf.json"])).toBe(false);
    expect(shouldCleanStaleMacosDevBundle(["dev", "-c", "src-tauri/tauri.conf.json"])).toBe(false);
  });
});

describe("removeStaleMacosDevBundle", () => {
  it.each([
    {
      name: "the bundle identifier key and dev value are present",
      infoPlist:
        '<?xml version="1.0"?><plist><dict><key>CFBundleIdentifier</key><string>com.ultra-rss-reader.dev</string></dict></plist>',
      expectedMarker: true,
      expectedRemoved: true,
    },
    {
      name: "the bundle identifier key is missing",
      infoPlist: '<?xml version="1.0"?><plist><dict><string>com.ultra-rss-reader.dev</string></dict></plist>',
      expectedMarker: false,
      expectedRemoved: false,
    },
    {
      name: "the dev bundle identifier value is missing",
      infoPlist:
        '<?xml version="1.0"?><plist><dict><key>CFBundleIdentifier</key><string>com.jey3dayo.ultra-rss-reader</string></dict></plist>',
      expectedMarker: false,
      expectedRemoved: false,
    },
  ])("keeps Info.plist marker cleanup behavior when $name", async ({ infoPlist, expectedMarker, expectedRemoved }) => {
    const removedPaths: string[] = [];

    const removed = await removeStaleMacosDevBundle({
      cwd: "/repo",
      platform: "darwin",
      readFileImpl: async () => infoPlist,
      rmImpl: async (targetPath) => {
        removedPaths.push(normalizePathSeparators(String(targetPath)));
      },
    });

    expect(hasMacosDevBundleIdentifierMarker(infoPlist)).toBe(expectedMarker);
    expect(removed).toBe(expectedRemoved);
    expect(removedPaths.length > 0).toBe(expectedRemoved);
  });

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
      "/repo/src-tauri/target/debug/bundle/macos/Ultra RSS Reader Dev.app",
      "/repo/src-tauri/target/release/bundle/macos/Ultra RSS Reader Dev.app",
      "/repo/src-tauri/target/debug/bundle/macos/Ultra RSS Reader.app",
      "/repo/src-tauri/target/release/bundle/macos/Ultra RSS Reader.app",
    ]);
  });

  it("checks stale macOS bundle candidates concurrently before removal", async () => {
    const requestedInfoPlists: string[] = [];
    const releaseReads = new Map<string, () => void>();
    const removedPaths: string[] = [];

    const removedPromise = removeStaleMacosDevBundle({
      cwd: "/repo",
      platform: "darwin",
      readFileImpl: async (targetPath) => {
        const pathText = normalizePathSeparators(String(targetPath));
        requestedInfoPlists.push(pathText);
        await new Promise<void>((resolve) => {
          releaseReads.set(pathText, resolve);
        });
        return `<?xml version="1.0"?><plist><dict><key>CFBundleIdentifier</key><string>com.ultra-rss-reader.dev</string></dict></plist>`;
      },
      rmImpl: async (targetPath) => {
        removedPaths.push(normalizePathSeparators(String(targetPath)));
      },
    });

    await Promise.resolve();
    expect(requestedInfoPlists).toEqual([
      "/repo/src-tauri/target/debug/bundle/macos/Ultra RSS Reader Dev.app/Contents/Info.plist",
      "/repo/src-tauri/target/release/bundle/macos/Ultra RSS Reader Dev.app/Contents/Info.plist",
      "/repo/src-tauri/target/debug/bundle/macos/Ultra RSS Reader.app/Contents/Info.plist",
      "/repo/src-tauri/target/release/bundle/macos/Ultra RSS Reader.app/Contents/Info.plist",
    ]);
    expect(removedPaths).toEqual([]);

    for (const releaseRead of releaseReads.values()) {
      releaseRead();
    }

    await expect(removedPromise).resolves.toBe(true);
    expect(removedPaths).toEqual([
      "/repo/src-tauri/target/debug/bundle/macos/Ultra RSS Reader Dev.app",
      "/repo/src-tauri/target/release/bundle/macos/Ultra RSS Reader Dev.app",
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
      VITE_DEV_INTENT: "open-subscriptions-index",
    });

    expect(spawnSpec.command).toBe("sh");
    expect(spawnSpec.args[0]).toBe("-lc");
    expect(spawnSpec.args[1]).toContain(
      "powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -OutputFormat Text -EncodedCommand ",
    );
    expect(spawnSpec.args[1]).not.toContain("open-subscriptions-index");

    const encodedCommand = spawnSpec.args[1].split(" -EncodedCommand ")[1];
    const powerShellScript = Buffer.from(encodedCommand, "base64").toString("utf16le");
    expect(powerShellScript).toContain("$ProgressPreference = 'SilentlyContinue'");
    expect(powerShellScript).toContain("[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()");
    expect(powerShellScript).toContain("$env:HOME = $env:USERPROFILE");
    expect(powerShellScript).toContain("[Environment]::GetEnvironmentVariable('Path', 'Machine')");
    expect(powerShellScript).toContain("& 'pnpm' 'exec' 'tauri'");
  });

  it("keeps Windows cwd and forwarded env values quoted in the dry-run PowerShell payload", () => {
    const spawnSpec = buildWslTauriSpawnSpec(["dev"], "C:\\Users\\Dev O'Neil\\repo", {
      DEV_CREDENTIALS: "local user",
      VITE_DEV_INTENT: "  ",
      TAURI_DEV_PORT: "1420",
    });

    const encodedCommand = spawnSpec.args[1].split(" -EncodedCommand ")[1];
    const powerShellScript = Buffer.from(encodedCommand, "base64").toString("utf16le");

    expect(powerShellScript).toContain("Set-Location -LiteralPath 'C:\\Users\\Dev O''Neil\\repo'");
    expect(powerShellScript).toContain("$env:DEV_CREDENTIALS = 'local user'");
    expect(powerShellScript).toContain("$env:VITE_DEV_INTENT = '  '");
    expect(powerShellScript).toContain("$env:TAURI_DEV_PORT = '1420'");
    expect(powerShellScript).toContain("& 'pnpm' 'exec' 'tauri' 'dev'");
  });

  it("omits secret-like env overrides from the encoded PowerShell payload", () => {
    const envOverrides = pickWindowsEnvOverrides({
      DEV_CREDENTIALS: "1",
      TAURI_DEV_PORT: "1420",
      TAURI_SIGNING_PRIVATE_KEY: "key'part",
      TAURI_SIGNING_PRIVATE_KEY_PASSWORD: "password",
      VITE_API_TOKEN: "token",
    });
    const spawnSpec = buildWslTauriSpawnSpec(["dev"], "C:\\repo", envOverrides);

    const encodedCommand = spawnSpec.args[1].split(" -EncodedCommand ")[1];
    const powerShellScript = Buffer.from(encodedCommand, "base64").toString("utf16le");

    expect(powerShellScript).toContain("$env:DEV_CREDENTIALS = '1'");
    expect(powerShellScript).toContain("$env:TAURI_DEV_PORT = '1420'");
    expect(powerShellScript).not.toContain("TAURI_SIGNING_PRIVATE_KEY");
    expect(powerShellScript).not.toContain("TAURI_SIGNING_PRIVATE_KEY_PASSWORD");
    expect(powerShellScript).not.toContain("VITE_API_TOKEN");
    expect(powerShellScript).not.toContain("key'part");
    expect(powerShellScript).not.toContain("password");
    expect(powerShellScript).not.toContain("token");
  });
});
