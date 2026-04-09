import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readDefaultCapability(): { permissions: string[] } {
  const currentFile = fileURLToPath(import.meta.url);
  const currentDir = path.dirname(currentFile);
  const capabilityPath = path.resolve(currentDir, "../../src-tauri/capabilities/default.json");
  return JSON.parse(readFileSync(capabilityPath, "utf8")) as { permissions: string[] };
}

describe("tauri window capability contract", () => {
  it("keeps the dev window resize permissions available to the main webview", () => {
    const capability = readDefaultCapability();

    expect(capability.permissions).toEqual(
      expect.arrayContaining([
        "core:window:allow-center",
        "core:window:allow-set-size",
        "core:window:allow-unmaximize",
      ]),
    );
  });
});
