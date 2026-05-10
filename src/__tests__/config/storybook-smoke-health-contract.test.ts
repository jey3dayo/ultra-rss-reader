import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();

function readRepoFile(path: string) {
  return readFileSync(join(repoRoot, path), "utf8");
}

describe("Storybook smoke health contract", () => {
  it("checks the Storybook registry before iframe smoke", () => {
    const storybookPlaywrightConfig = readRepoFile("playwright.storybook.config.ts");
    const storybookIndexPayload = readRepoFile("e2e/storybook/storybook-index-payload.ts");
    const smokeSpec = readRepoFile("e2e/storybook/ui-reference-canvas-smoke.spec.ts");

    expect(storybookPlaywrightConfig).toContain("reuseExistingServer: false");
    expect(smokeSpec).toContain("test.beforeAll");
    expect(smokeSpec).toContain("denseNarrowSmokeViewport");
    expect(smokeSpec).toContain("storybookViewportMaxDimensionPx");
    expect(smokeSpec).not.toContain("../../src/");
    expect(smokeSpec).not.toContain("@/");
    expect(storybookIndexPayload).not.toContain("../../src/");
    expect(storybookIndexPayload).not.toContain("@/");
    expect(smokeSpec).toContain("/index.json");
    expect(smokeSpec).toContain("verifies Storybook story registry before iframe smoke");
  });
});
