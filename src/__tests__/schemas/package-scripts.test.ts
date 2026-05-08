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

function readWorkspaceFile(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

function extractMiseTaskNames(miseToml: string): Set<string> {
  return new Set([...miseToml.matchAll(/^\[tasks\.([^\]\n]+)\]/gm)].map((match) => match[1]?.replaceAll('"', "") ?? ""));
}

function extractReadmeMiseCommands(readme: string): string[] {
  return [...new Set([...readme.matchAll(/mise run ([a-z0-9:_-]+)/g)].map((match) => match[1] ?? ""))]
    .filter(Boolean)
    .sort();
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

  it("keeps Playwright browser E2E config aligned with the Vite dev server", () => {
    const playwrightConfig = readWorkspaceFile("playwright.config.ts");
    const viteConfig = readWorkspaceFile("vite.config.ts");

    expect(playwrightConfig).toContain('baseURL: "http://localhost:1420"');
    expect(playwrightConfig).toContain('url: "http://localhost:1420"');
    expect(viteConfig).toContain("port: 1420");
    expect(viteConfig).toContain("strictPort: true");
  });

  it("exposes Storybook E2E and build-storybook through mise tasks", () => {
    const packageJson = readPackageJson();
    const miseToml = readWorkspaceFile("mise.toml");
    const miseTasks = extractMiseTaskNames(miseToml);

    expect(packageJson.scripts?.["test:storybook:e2e"]).toBe(
      "pnpm exec playwright test --config playwright.storybook.config.ts",
    );
    expect(packageJson.scripts?.["build-storybook"]).toBe("storybook build");
    expect(miseTasks.has("test:storybook:e2e")).toBe(true);
    expect(miseTasks.has("build:storybook")).toBe(true);
    expect(miseToml).toContain("pnpm run test:storybook:e2e");
    expect(miseToml).toContain("pnpm run build-storybook");
  });

  it("exposes Tauri Vite manager check mode through mise", () => {
    const miseToml = readWorkspaceFile("mise.toml");
    const miseTasks = extractMiseTaskNames(miseToml);

    expect(readWorkspaceFile("scripts/tauri-dev-vite-manager.ts")).toContain('args.includes("--check")');
    expect(miseTasks.has("app:dev:vite-check")).toBe(true);
    expect(miseToml).toContain("node ./scripts/tauri-dev-vite-manager.ts --check");
  });

  it("keeps README mise commands backed by mise tasks", () => {
    const readmeCommands = extractReadmeMiseCommands(readWorkspaceFile("README.md"));
    const miseTasks = extractMiseTaskNames(readWorkspaceFile("mise.toml"));

    expect(readmeCommands.filter((command) => !miseTasks.has(command))).toEqual([]);
  });
});
