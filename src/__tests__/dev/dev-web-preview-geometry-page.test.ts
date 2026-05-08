import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createDevWebPreviewGeometryFixture } from "@/dev/web-preview-geometry";

function readGeometryPageHtml(): string {
  const currentFile = fileURLToPath(import.meta.url);
  const currentDir = path.dirname(currentFile);
  return readFileSync(path.resolve(currentDir, "../../../public/dev-web-preview-geometry.html"), "utf8");
}

describe("dev web preview geometry page", () => {
  it("keeps the left and right edge rails visible for fullscreen width checks", () => {
    const html = readGeometryPageHtml();
    const fixture = createDevWebPreviewGeometryFixture();

    expect(html).toContain(`${fixture.rails.left.cssVariable}: ${fixture.rails.left.color};`);
    expect(html).toContain(`${fixture.rails.right.cssVariable}: ${fixture.rails.right.color};`);
    expect(html).toContain(fixture.summary.title);
    expect(html).toContain(fixture.summary.description);
    expect(html).toContain(fixture.rails.left.label);
    expect(html).toContain(fixture.rails.right.label);
    for (const check of fixture.checks) {
      expect(html).toContain(check.title);
      expect(html).toContain(check.description);
    }
  });
});
