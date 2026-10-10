import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();

function readRepoFile(path: string) {
  return readFileSync(join(repoRoot, path), "utf8");
}

describe("Storybook smoke health contract", () => {
  it("keeps the Storybook smoke spec independent of app source imports", () => {
    for (const path of [
      "e2e/storybook/ui-reference-canvas-smoke.spec.ts",
      "e2e/storybook/storybook-index-payload.ts",
    ]) {
      const source = readRepoFile(path);
      expect(source).not.toContain("../../src/");
      expect(source).not.toContain("@/");
    }
  });
});
