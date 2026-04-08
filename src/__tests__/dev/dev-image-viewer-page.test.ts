import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readDebugPageHtml(): string {
  const currentFile = fileURLToPath(import.meta.url);
  const currentDir = path.dirname(currentFile);
  return readFileSync(path.resolve(currentDir, "../../../public/dev-image-viewer.html"), "utf8");
}

describe("dev image viewer page", () => {
  it("keeps the mock page anchored near the top of the viewport for overlay tuning", () => {
    const html = readDebugPageHtml();

    expect(html).toMatch(/align-items:\s*flex-start;/);
    expect(html).toMatch(/justify-content:\s*center;/);
    expect(html).toMatch(/place-items:\s*start center;/);
  });
});
