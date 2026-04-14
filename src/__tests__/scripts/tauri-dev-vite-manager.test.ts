import { describe, expect, it } from "vitest";
import { classifyPortOwnerCommandLine } from "../../../scripts/tauri-dev-vite-manager.mjs";

describe("classifyPortOwnerCommandLine", () => {
  it("treats pnpm exec vite as restartable", () => {
    expect(classifyPortOwnerCommandLine("pnpm exec vite")).toBe("vite");
  });

  it("treats the vite node entrypoint as restartable", () => {
    expect(classifyPortOwnerCommandLine("node ./node_modules/vite/bin/vite.js")).toBe("vite");
  });

  it("treats unrelated listeners as foreign", () => {
    expect(classifyPortOwnerCommandLine("python -m http.server 1420")).toBe("foreign");
  });

  it("treats empty command lines as unknown", () => {
    expect(classifyPortOwnerCommandLine("")).toBe("unknown");
  });
});
