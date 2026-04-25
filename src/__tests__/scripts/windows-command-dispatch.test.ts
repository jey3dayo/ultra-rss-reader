import { describe, expect, it } from "vitest";
import {
  buildLocalCommandSpawnSpec,
  buildWslWindowsCommandSpawnSpec,
  isWslEnvironment,
  pickWindowsEnvOverrides,
} from "../../../scripts/windows-command-dispatch.mjs";

describe("windows-command-dispatch isWslEnvironment", () => {
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

describe("windows-command-dispatch pickWindowsEnvOverrides", () => {
  it("forwards task-specific environment variables only", () => {
    expect(
      pickWindowsEnvOverrides({
        DEV_CREDENTIALS: "1",
        RUST_LOG: "info",
        PATH: "/usr/bin",
        HOME: "/home/dev",
      }),
    ).toEqual({
      DEV_CREDENTIALS: "1",
      RUST_LOG: "info",
    });
  });
});

describe("buildLocalCommandSpawnSpec", () => {
  it("spawns the requested command directly", () => {
    expect(buildLocalCommandSpawnSpec("cargo", ["clippy"])).toEqual({
      command: "cargo",
      args: ["clippy"],
    });
  });
});

describe("buildWslWindowsCommandSpawnSpec", () => {
  it("dispatches arbitrary commands through sanitized Windows PowerShell", () => {
    const spawnSpec = buildWslWindowsCommandSpawnSpec(
      "cargo",
      ["clippy", "--manifest-path", "src-tauri/Cargo.toml"],
      "C:\\repo",
      { RUST_LOG: "info" },
    );

    expect(spawnSpec.command).toBe("sh");
    expect(spawnSpec.args[0]).toBe("-lc");
    expect(spawnSpec.args[1]).toContain(
      "powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -OutputFormat Text -EncodedCommand ",
    );

    const encodedCommand = spawnSpec.args[1].split(" -EncodedCommand ")[1];
    const powerShellScript = Buffer.from(encodedCommand, "base64").toString("utf16le");
    expect(powerShellScript).toContain("$ProgressPreference = 'SilentlyContinue'");
    expect(powerShellScript).toContain("[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()");
    expect(powerShellScript).toContain("$env:HOME = $env:USERPROFILE");
    expect(powerShellScript).toContain("[Environment]::GetEnvironmentVariable('Path', 'Machine')");
    expect(powerShellScript).toContain("Set-Location -LiteralPath 'C:\\repo'");
    expect(powerShellScript).toContain("& 'cargo' 'clippy' '--manifest-path' 'src-tauri/Cargo.toml'");
    expect(powerShellScript).toContain("$env:RUST_LOG = 'info'");
  });
});
