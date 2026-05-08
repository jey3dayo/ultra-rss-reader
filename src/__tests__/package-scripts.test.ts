import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { z } from "zod";

const packageJsonSchema = z.object({
  scripts: z.record(z.string(), z.string()).optional(),
  devDependencies: z.record(z.string(), z.string()).optional(),
});

type PackageJson = z.infer<typeof packageJsonSchema>;

function parsePackageJson(value: string): PackageJson {
  const parsed = packageJsonSchema.safeParse(JSON.parse(value));
  return parsed.success ? parsed.data : {};
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
