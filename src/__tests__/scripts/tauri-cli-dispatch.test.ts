import { describe, expect, it } from "vitest";
import {
  buildLocalTauriSpawnSpec,
  buildWslTauriSpawnSpec,
  isWslEnvironment,
  pickWindowsEnvOverrides,
} from "../../../scripts/tauri-cli-dispatch.mjs";

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
  it("spawns the local Tauri CLI through the current Node executable", () => {
    const spawnSpec = buildLocalTauriSpawnSpec(
      ["dev", "-c", "src-tauri/tauri.dev.conf.json"],
      "file:///C:/repo/scripts/tauri-cli-dispatch.mjs",
    );

    expect(spawnSpec.command).toBe(process.execPath);
    expect(spawnSpec.args[0]).toMatch(/node_modules[\\/]+@tauri-apps[\\/]+cli[\\/]+tauri\.js$/);
    expect(spawnSpec.args.slice(1)).toEqual(["dev", "-c", "src-tauri/tauri.dev.conf.json"]);
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
    expect(spawnSpec.args[1]).toContain("powershell.exe -NoProfile -ExecutionPolicy Bypass -EncodedCommand ");
    expect(spawnSpec.args[1]).not.toContain("open-feed-cleanup");
  });
});
