import { describe, expect, it } from "vitest";
import {
  buildWindowsDispatchSpawnFailureMessage,
  buildWindowsPathConversionFailureMessage,
  isSecretLikeEnvValue,
} from "../../../scripts/lib/windows-dispatch.ts";
import {
  buildLocalCommandSpawnSpec,
  buildWslWindowsCommandSpawnSpec,
  isWslEnvironment,
  pickWindowsEnvOverrides,
} from "../../../scripts/windows-command-dispatch.ts";

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
        DEV_DIAGNOSTIC_FLAG: "1",
        RUST_LOG: "info",
        RUSTFLAGS: "-Awarnings",
        TAURI_DEV_PORT: "1420",
        TAURI_TRACE_CONTEXT: "debug",
        TAURI_SIGNING_PRIVATE_KEY: "secret-key",
        TAURI_SIGNING_PRIVATE_KEY_PASSWORD: "secret-password",
        TAURI_UPDATE_SECRET: "secret-value",
        VITE_PUBLIC_DEBUG_TOKENLESS: "github_pat_1234567890abcdef",
        VITE_API_TOKEN: "secret-token",
        VITE_DEV_CREDENTIALS: "secret-credentials",
        VITE_DEV_INTENT: "open-subscriptions-index",
        VITE_DEV_WEB_URL: "https://example.com/debug",
        PATH: "/usr/bin",
        HOME: "/home/dev",
      }),
    ).toEqual({
      DEV_CREDENTIALS: "1",
      RUST_LOG: "info",
      TAURI_DEV_PORT: "1420",
      VITE_DEV_INTENT: "open-subscriptions-index",
      VITE_DEV_WEB_URL: "https://example.com/debug",
    });
  });

  it("keeps DEV_CREDENTIALS as the only credentials-suffixed exception", () => {
    expect(
      pickWindowsEnvOverrides({
        DEV_CREDENTIALS: "github_pat_1234567890abcdef",
        VITE_DEV_CREDENTIALS: "1",
      }),
    ).toEqual({
      DEV_CREDENTIALS: "github_pat_1234567890abcdef",
    });
  });
});

describe("windows-dispatch secret-like env values", () => {
  it("detects token-shaped values independent of env key suffixes", () => {
    expect(isSecretLikeEnvValue("github_pat_1234567890abcdef")).toBe(true);
    expect(isSecretLikeEnvValue("ghp_1234567890abcdef")).toBe(true);
    expect(isSecretLikeEnvValue("open-subscriptions-index")).toBe(false);
    expect(isSecretLikeEnvValue("https://example.com/debug")).toBe(false);
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

describe("buildWindowsDispatchSpawnFailureMessage", () => {
  it("includes missing executable diagnostics without leaking env values", () => {
    const error = new Error("spawn pnpm ENOENT") as NodeJS.ErrnoException;
    error.code = "ENOENT";
    error.path = "pnpm";

    const message = buildWindowsDispatchSpawnFailureMessage("pnpm", error);

    expect(message).toContain("Windows dispatch failed");
    expect(message).toContain("stage: spawn");
    expect(message).toContain("command: pnpm");
    expect(message).toContain("code: ENOENT");
    expect(message).toContain("path: pnpm");
    expect(message).toContain("Windows Path");
    expect(message).toContain("working directory");
  });

  it("includes permission diagnostics for spawn EACCES failures", () => {
    const error = new Error(
      "spawn powershell.exe EACCES",
    ) as NodeJS.ErrnoException;
    error.code = "EACCES";
    error.path = "powershell.exe";

    const message = buildWindowsDispatchSpawnFailureMessage("sh", error);

    expect(message).toContain("Windows dispatch failed");
    expect(message).toContain("stage: spawn");
    expect(message).toContain("command: sh");
    expect(message).toContain("code: EACCES");
    expect(message).toContain("path: powershell.exe");
    expect(message).toContain("accessible");
  });
});

describe("buildWindowsPathConversionFailureMessage", () => {
  it("reports WSL cwd conversion failures without env diagnostics", () => {
    const message = buildWindowsPathConversionFailureMessage(
      "/home/dev/repo",
      new Error("wslpath failed"),
    );

    expect(message).toContain("Windows dispatch failed");
    expect(message).toContain("stage: path conversion");
    expect(message).toContain("cwd: /home/dev/repo");
    expect(message).toContain("wslpath is installed");
    expect(message).toContain("accessible from Windows");
    expect(message).toContain("wslpath failed");
    expect(message).not.toContain("SECRET");
    expect(message).not.toContain("TOKEN");
  });

  it("uses the same diagnostic wrapper shape as spawn failures", () => {
    const pathConversionMessage = buildWindowsPathConversionFailureMessage(
      "/home/dev/repo",
      new Error("wslpath failed"),
    );
    const spawnMessage = buildWindowsDispatchSpawnFailureMessage(
      "pnpm",
      new Error("spawn failed"),
    );

    expect(pathConversionMessage).toMatch(
      /^Windows dispatch failed \(stage: path conversion; /,
    );
    expect(spawnMessage).toMatch(/^Windows dispatch failed \(stage: spawn; /);
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
    const powerShellScript = Buffer.from(encodedCommand, "base64").toString(
      "utf16le",
    );
    expect(powerShellScript).toContain(
      "$ProgressPreference = 'SilentlyContinue'",
    );
    expect(powerShellScript).toContain(
      "[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()",
    );
    expect(powerShellScript).toContain("$env:HOME = $env:USERPROFILE");
    expect(powerShellScript).toContain(
      "[Environment]::GetEnvironmentVariable('Path', 'Machine')",
    );
    expect(powerShellScript).toContain("Set-Location -LiteralPath 'C:\\repo'");
    expect(powerShellScript).toContain(
      "& 'cargo' 'clippy' '--manifest-path' 'src-tauri/Cargo.toml'",
    );
    expect(powerShellScript).toContain("$env:RUST_LOG = 'info'");
  });

  it("quotes Windows cwd, command args, and env overrides in the dry-run PowerShell payload", () => {
    const spawnSpec = buildWslWindowsCommandSpawnSpec(
      "pnpm",
      ["exec", "tauri", "dev", "--", "O'Neil"],
      "C:\\repo dir",
      {
        DEV_CREDENTIALS: "windows user",
        VITE_DEV_INTENT: "open-subscriptions-index",
        RUST_LOG: "debug'level",
      },
    );

    const encodedCommand = spawnSpec.args[1].split(" -EncodedCommand ")[1];
    const powerShellScript = Buffer.from(encodedCommand, "base64").toString(
      "utf16le",
    );

    expect(powerShellScript).toContain(
      "Set-Location -LiteralPath 'C:\\repo dir'",
    );
    expect(powerShellScript).toContain("$env:DEV_CREDENTIALS = 'windows user'");
    expect(powerShellScript).toContain(
      "$env:VITE_DEV_INTENT = 'open-subscriptions-index'",
    );
    expect(powerShellScript).toContain("$env:RUST_LOG = 'debug''level'");
    expect(powerShellScript).toContain(
      "& 'pnpm' 'exec' 'tauri' 'dev' '--' 'O''Neil'",
    );
  });
});
