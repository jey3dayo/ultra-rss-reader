import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { setupBrowserTestDom } from "@tests/helpers/browser-test-globals";
import { describe, expect, it } from "vitest";
import { createDevWebPreviewGeometryFixture } from "@/dev/web-preview-geometry";

setupBrowserTestDom();

function readGeometryPageHtml(): string {
  const currentFile = fileURLToPath(import.meta.url);
  const currentDir = path.dirname(currentFile);
  return readFileSync(path.resolve(currentDir, "../../../public/dev-web-preview-geometry.html"), "utf8");
}

function requireElement(root: ParentNode, selector: string): Element {
  const element = root.querySelector(selector);

  expect(element, selector).not.toBeNull();
  if (element === null) {
    throw new Error(`Missing geometry page element: ${selector}`);
  }

  return element;
}

function readRootCssVariableValue(styleText: string, cssVariable: string): string {
  const declaration = styleText
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.startsWith(`${cssVariable}:`));

  expect(declaration, cssVariable).toBeDefined();
  if (declaration === undefined) {
    throw new Error(`Missing geometry page CSS variable: ${cssVariable}`);
  }

  return declaration
    .slice(cssVariable.length + 1)
    .replace(";", "")
    .trim();
}

describe("dev web preview geometry page", () => {
  it("keeps the HTML artifact structurally aligned with the geometry fixture contract", () => {
    const html = readGeometryPageHtml();
    const document = new DOMParser().parseFromString(html, "text/html");
    const fixture = createDevWebPreviewGeometryFixture();
    const styleText = requireElement(document, "style").textContent ?? "";

    expect(requireElement(document, 'meta[name="dev-web-preview-geometry:path"]').getAttribute("content")).toBe(
      fixture.path,
    );
    expect(html.match(new RegExp(`${fixture.rails.left.cssVariable}:`, "g"))).toHaveLength(1);
    expect(html.match(new RegExp(`${fixture.rails.right.cssVariable}:`, "g"))).toHaveLength(1);
    expect(readRootCssVariableValue(styleText, fixture.rails.left.cssVariable)).toBe(fixture.rails.left.color);
    expect(readRootCssVariableValue(styleText, fixture.rails.right.cssVariable)).toBe(fixture.rails.right.color);
    expect(styleText).toContain(
      `var(${fixture.rails.left.cssVariable}) 0 14px,\n            var(--surface) 14px calc(100% - 14px),\n            var(${fixture.rails.right.cssVariable}) calc(100% - 14px) 100%`,
    );
    expect(styleText).toContain("grid-template-columns: 14px 1fr 14px;");
    expect(styleText).toContain(`background: var(${fixture.rails.left.cssVariable});`);
    expect(styleText).toContain(`background: var(${fixture.rails.right.cssVariable});`);

    expect(requireElement(document, ".summary strong").textContent).toBe(fixture.summary.title);
    expect(requireElement(document, ".summary span").textContent).toBe(fixture.summary.description);

    const railLabels = Array.from(document.querySelectorAll(".top-band [data-geometry-rail]")).map((element) => ({
      label: element.textContent,
      side: element.getAttribute("data-geometry-rail"),
    }));
    expect(railLabels).toEqual([
      { label: fixture.rails.left.label, side: "left" },
      { label: fixture.rails.right.label, side: "right" },
    ]);

    const rulerRails = Array.from(document.querySelectorAll(".ruler [data-geometry-rail]")).map((element) =>
      element.getAttribute("data-geometry-rail"),
    );
    expect(rulerRails).toEqual(["left", "right"]);

    const cards = Array.from(document.querySelectorAll("main.grid > .card")).map((element) => ({
      description: requireElement(element, "p").textContent,
      title: requireElement(element, "h2").textContent,
    }));
    expect(cards).toEqual(fixture.checks);
  });
});
