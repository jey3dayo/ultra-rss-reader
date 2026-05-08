import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { type PackageJson, PackageJsonSchema } from "@/schemas/app-config";
import { parseJsonWithSchema } from "@/schemas/parse";

function parsePackageJson(value: string): PackageJson {
  try {
    return parseJsonWithSchema(value, PackageJsonSchema);
  } catch {
    return {};
  }
}

function readPackageJson(): PackageJson {
  return parsePackageJson(readFileSync(resolve(process.cwd(), "package.json"), "utf8"));
}

describe("package scripts", () => {
  it("keeps fixed-port development scripts unchanged", () => {
    const scripts = readPackageJson().scripts;

    expect(scripts?.dev).toBe("pnpm exec vite");
    expect(scripts?.storybook).toBe("storybook dev -p 6006 --no-open");
  });

  it("adds portless entrypoints for browser development and storybook", () => {
    const packageJson = readPackageJson();

    expect(packageJson.devDependencies?.portless).toBeDefined();
    expect(packageJson.scripts?.["dev:portless"]).toBe("portless ultra-rss-reader pnpm exec vite");
    expect(packageJson.scripts?.["storybook:portless"]).toBe(
      'portless storybook.ultra-rss-reader sh -c \'storybook dev -p "$PORT" --host "$HOST" --no-open\'',
    );
  });
});
