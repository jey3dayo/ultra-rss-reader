import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readGeometryPageHtml(): string {
  const currentFile = fileURLToPath(import.meta.url);
  const currentDir = path.dirname(currentFile);
  return readFileSync(path.resolve(currentDir, "../../../public/dev-web-preview-geometry.html"), "utf8");
}

describe("dev web preview geometry page", () => {
  it("keeps the left and right edge rails visible for fullscreen width checks", () => {
    const html = readGeometryPageHtml();

    expect(html).toMatch(/--edge-left:\s*#2563eb;/);
    expect(html).toMatch(/--edge-right:\s*#f43f5e;/);
    expect(html).toContain("native webview should touch both colored rails");
    expect(html).toContain("left edge");
    expect(html).toContain("right edge");
  });
});
