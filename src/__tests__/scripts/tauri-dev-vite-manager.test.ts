import { describe, expect, it } from "vitest";
import { buildViteSpawnSpec, classifyPortOwnerCommandLine } from "../../../scripts/tauri-dev-vite-manager.mjs";

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
    const spawnSpec = buildViteSpawnSpec("file:///C:/repo/scripts/tauri-dev-vite-manager.mjs");

    expect(spawnSpec.command).toBe(process.execPath);
    expect(spawnSpec.args).toHaveLength(6);
    expect(spawnSpec.args[0]).toMatch(/node_modules[\\/]+vite[\\/]+bin[\\/]+vite\.js$/);
    expect(spawnSpec.args.slice(1)).toEqual(["--host", "127.0.0.1", "--port", "1420", "--strictPort"]);
  });
});
