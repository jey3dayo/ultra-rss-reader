import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readAppShellSource() {
  return readFileSync(join(process.cwd(), "src/components/app-shell.tsx"), "utf8");
}

describe("AppShell bundle boundary", () => {
  it("keeps the Tauri window API out of the initial app shell import graph", () => {
    const source = readAppShellSource();

    expect(source).not.toContain('import { getCurrentWindow } from "@tauri-apps/api/window";');
    expect(source).toContain('await import("@tauri-apps/api/window")');
  });
});
