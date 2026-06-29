import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("production dev aliases", () => {
  it("replaces dev-intent runtime modules with production stubs during production builds", () => {
    const viteConfig = readFileSync("vite.config.ts", "utf8");

    expect(viteConfig).toContain('"@/dev/use-dev-intent"');
    expect(viteConfig).toContain('"@/dev/use-resolved-dev-intent"');
    expect(viteConfig).toContain('"@/dev/scenario-ids"');
    expect(viteConfig).toContain("src/dev/prod-stubs");
  });
});
