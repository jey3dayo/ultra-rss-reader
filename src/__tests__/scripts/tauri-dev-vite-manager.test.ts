import { describe, expect, it, vi } from "vitest";
import {
  buildPortWaitTimeoutMessage,
  buildViteSpawnSpec,
  classifyPortOwnerCommandLine,
  resolveTauriDevPort,
  runTauriDevViteManager,
} from "../../../scripts/tauri-dev-vite-manager.ts";

describe("classifyPortOwnerCommandLine", () => {
  it("treats pnpm exec vite as restartable", () => {
    expect(classifyPortOwnerCommandLine("pnpm exec vite")).toBe("vite");
  });

  it("treats the vite node entrypoint as restartable", () => {
    expect(classifyPortOwnerCommandLine("node ./node_modules/vite/bin/vite.js")).toBe("vite");
  });

  it("treats quoted Windows vite entrypoints with args as restartable", () => {
    expect(
      classifyPortOwnerCommandLine(
        'node "C:\\repo\\node_modules\\.pnpm\\vite@8.0.8\\node_modules\\vite\\bin\\vite.js" "--host" "127.0.0.1" "--port" "1420" "--strictPort"',
      ),
    ).toBe("vite");
  });

  it("treats unrelated listeners as foreign", () => {
    expect(classifyPortOwnerCommandLine("python -m http.server 1420")).toBe("foreign");
  });

  it("treats empty command lines as unknown", () => {
    expect(classifyPortOwnerCommandLine("")).toBe("unknown");
  });
});

describe("buildViteSpawnSpec", () => {
  it("spawns the local Vite cli through the current Node executable", () => {
    const spawnSpec = buildViteSpawnSpec("file:///C:/repo/scripts/tauri-dev-vite-manager.ts");

    expect(spawnSpec.command).toBe(process.execPath);
    expect(spawnSpec.args).toHaveLength(6);
    expect(spawnSpec.args[0]).toMatch(/node_modules[\\/]+vite[\\/]+bin[\\/]+vite\.js$/);
    expect(spawnSpec.args.slice(1)).toEqual(["--host", "127.0.0.1", "--port", "1420", "--strictPort"]);
  });

  it("uses the same explicit port that the manager checks before launch", () => {
    const spawnSpec = buildViteSpawnSpec("file:///C:/repo/scripts/tauri-dev-vite-manager.ts", 1432);

    expect(spawnSpec.args.slice(1)).toEqual(["--host", "127.0.0.1", "--port", "1432", "--strictPort"]);
  });
});

describe("resolveTauriDevPort", () => {
  it("uses the default port when TAURI_DEV_PORT is not set", () => {
    expect(resolveTauriDevPort({})).toBe(1420);
  });

  it.each(["", "  ", "1420.5", "0", "-1", "not-a-port"])("rejects invalid TAURI_DEV_PORT=%j", (value) => {
    expect(() => resolveTauriDevPort({ TAURI_DEV_PORT: value })).toThrow("TAURI_DEV_PORT");
  });

  it("accepts positive integer TAURI_DEV_PORT values", () => {
    expect(resolveTauriDevPort({ TAURI_DEV_PORT: "1432" })).toBe(1432);
  });

  it("keeps the static Vite startup port in sync with TAURI_DEV_PORT", () => {
    const port = resolveTauriDevPort({ TAURI_DEV_PORT: "1432" });
    const spawnSpec = buildViteSpawnSpec("file:///C:/repo/scripts/tauri-dev-vite-manager.ts", port);

    expect(spawnSpec.args.slice(1)).toEqual(["--host", "127.0.0.1", "--port", "1432", "--strictPort"]);
  });
});

describe("buildPortWaitTimeoutMessage", () => {
  it("includes the checked port, elapsed time, stale listener command, and next action", () => {
    expect(
      buildPortWaitTimeoutMessage({
        port: 1432,
        elapsedMs: 10_250,
        lastProcess: {
          pid: 123,
          commandLine: "node ./node_modules/vite/bin/vite.js --port 1432",
        },
      }),
    ).toContain("port 1432");
    expect(
      buildPortWaitTimeoutMessage({
        port: 1432,
        elapsedMs: 10_250,
        lastProcess: {
          pid: 123,
          commandLine: "node ./node_modules/vite/bin/vite.js --port 1432",
        },
      }),
    ).toContain("10250ms");
    expect(
      buildPortWaitTimeoutMessage({
        port: 1432,
        elapsedMs: 10_250,
        lastProcess: {
          pid: 123,
          commandLine: "node ./node_modules/vite/bin/vite.js --port 1432",
        },
      }),
    ).toContain("node ./node_modules/vite/bin/vite.js --port 1432");
    expect(
      buildPortWaitTimeoutMessage({
        port: 1432,
        elapsedMs: 10_250,
        lastProcess: {
          pid: 123,
          commandLine: "node ./node_modules/vite/bin/vite.js --port 1432",
        },
      }),
    ).toContain("Next action");
  });
});

describe("runTauriDevViteManager", () => {
  it("does not stop an existing Vite process in check mode", async () => {
    const stopProcessImpl = vi.fn();
    const waitForPortToBeFreeImpl = vi.fn();
    const spawnImpl = vi.fn();

    await runTauriDevViteManager({
      args: ["--check"],
      env: { TAURI_DEV_PORT: "1432" },
      getListeningProcessImpl: vi.fn(async (port) => ({
        pid: 123,
        commandLine: `node ./node_modules/vite/bin/vite.js --port ${port}`,
      })),
      stopProcessImpl,
      waitForPortToBeFreeImpl,
      spawnImpl,
      log: vi.fn(),
    });

    expect(stopProcessImpl).not.toHaveBeenCalled();
    expect(waitForPortToBeFreeImpl).not.toHaveBeenCalled();
    expect(spawnImpl).not.toHaveBeenCalled();
  });

  it("rejects foreign listeners instead of reusing them", async () => {
    const stopProcessImpl = vi.fn();
    const waitForPortToBeFreeImpl = vi.fn();
    const spawnImpl = vi.fn();

    await expect(
      runTauriDevViteManager({
        args: ["--check"],
        env: { TAURI_DEV_PORT: "1432" },
        getListeningProcessImpl: vi.fn(async () => ({
          pid: 456,
          commandLine: "python -m http.server 1432",
        })),
        stopProcessImpl,
        waitForPortToBeFreeImpl,
        spawnImpl,
        log: vi.fn(),
      }),
    ).rejects.toThrow("Port 1432 is already in use by another process");

    expect(stopProcessImpl).not.toHaveBeenCalled();
    expect(waitForPortToBeFreeImpl).not.toHaveBeenCalled();
    expect(spawnImpl).not.toHaveBeenCalled();
  });

  it("uses the resolved TAURI_DEV_PORT for listener checks and Vite launch", async () => {
    const checkedPorts: number[] = [];
    const spawnImpl = vi.fn(() => ({
      killed: false,
      kill: vi.fn(() => true),
      on: vi.fn(),
    }));

    await runTauriDevViteManager({
      args: [],
      env: { TAURI_DEV_PORT: "1432" },
      getListeningProcessImpl: vi.fn(async (port) => {
        checkedPorts.push(port);
        return null;
      }),
      spawnImpl,
      log: vi.fn(),
      scriptUrl: "file:///C:/repo/scripts/tauri-dev-vite-manager.ts",
    });

    expect(checkedPorts).toEqual([1432]);
    expect(spawnImpl).toHaveBeenCalledWith(
      process.execPath,
      expect.arrayContaining(["--port", "1432"]),
      expect.objectContaining({ stdio: "inherit" }),
    );
  });
});
