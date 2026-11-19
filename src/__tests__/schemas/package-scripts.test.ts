import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { is, parse } from "valibot";
import { describe, expect, it } from "vitest";
import { type PackageJson, PackageJsonSchema } from "@/schemas/app-config";
import { isSchemaParseError, parseJsonWithSchema } from "@/schemas/parse";

function parsePackageJson(value: string): PackageJson {
  return parseJsonWithSchema(value, PackageJsonSchema);
}

function readPackageJson(): PackageJson {
  return parsePackageJson(readFileSync(resolve(process.cwd(), "package.json"), "utf8"));
}

function readWorkspaceFile(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

function readMiseTaskCorpus(): string {
  return ["mise.toml", "mise/deploy.toml", "mise/format.toml", "mise/lint.toml", "mise/quality.toml", "mise/test.toml"]
    .map(readWorkspaceFile)
    .join("\n");
}

function extractMiseTaskNames(miseToml: string): Set<string> {
  return new Set(
    [...miseToml.matchAll(/^(?:\[tasks\.([^\]\n]+)\]|\["([^"\]\n]+)"\])/gm)].map((match) =>
      (match[1] ?? match[2] ?? "").replaceAll('"', ""),
    ),
  );
}

function extractMiseTaskSection(miseToml: string, taskName: string): string {
  const lines = miseToml.split("\n").map((line) => line.trimEnd());
  const sectionStart = lines.findIndex((line) => line === `[tasks."${taskName}"]` || line === `["${taskName}"]`);
  if (sectionStart === -1) {
    return "";
  }

  const sectionLines = lines.slice(sectionStart + 1);
  const sectionEnd = sectionLines.findIndex((line) => line.startsWith("[tasks.") || /^\["[^"]+"\]$/.test(line));
  return sectionLines.slice(0, sectionEnd === -1 ? undefined : sectionEnd).join("\n");
}

function extractMiseEnvValues(miseToml: string, prefix: string): string[] {
  return [...miseToml.matchAll(new RegExp(`^${prefix}[A-Z0-9_]*\\s*=\\s*"([^"]+)"`, "gm"))].map(
    (match) => match[1] ?? "",
  );
}

function extractMiseEnvMap(miseToml: string, prefix: string): Map<string, string> {
  return new Map(
    [...miseToml.matchAll(new RegExp(`^(${prefix}[A-Z0-9_]*)\\s*=\\s*"([^"]+)"`, "gm"))].map((match) => [
      match[1] ?? "",
      match[2] ?? "",
    ]),
  );
}

function extractMiseTaskCommand(miseToml: string, taskName: string, commandName: "run" | "run_windows"): string {
  const taskSection = extractMiseTaskSection(miseToml, taskName);
  return taskSection.match(new RegExp(`^${commandName}\\s*=\\s*"([^"]+)"`, "m"))?.[1] ?? "";
}

function extractMarkdownlintTargets(command: string): string[] {
  const args = command.split(/\s+/);
  const markdownlintIndex = args.findIndex((arg) => arg.includes("markdownlint-cli2"));
  if (markdownlintIndex === -1) {
    return [];
  }

  return args.slice(markdownlintIndex + 1).filter((arg) => arg !== "--fix");
}

function extractMarkdownlintInvocation(command: string): string[] {
  const args = command.split(/\s+/);
  const markdownlintIndex = args.findIndex((arg) => arg.includes("markdownlint-cli2"));

  return markdownlintIndex === -1 ? [] : args.slice(0, markdownlintIndex + 1);
}

function resolveMiseEnvReferences(args: string[], env: Map<string, string>): string[] {
  return args.map((arg) => {
    const posixEnvName = arg.match(/^\$([A-Z0-9_]+)$/)?.[1];
    const pwshEnvName = arg.match(/^\$env:([A-Z0-9_]+)$/)?.[1];
    const windowsEnvName = arg.match(/^%([A-Z0-9_]+)%$/)?.[1];
    const envName = posixEnvName ?? pwshEnvName ?? windowsEnvName;

    return envName === undefined ? arg : (env.get(envName) ?? arg);
  });
}

function extractMarkdownTaskTargets(
  miseToml: string,
  taskName: "format:md" | "lint:md",
  commandName: "run" | "run_windows",
): string[] {
  return extractMarkdownlintTargets(extractMiseTaskCommand(miseToml, taskName, commandName));
}

function extractReadmeMiseCommands(readme: string): string[] {
  return [...new Set([...readme.matchAll(/mise run ([a-z0-9:_-]+)/g)].map((match) => match[1] ?? ""))]
    .filter(Boolean)
    .toSorted();
}

describe("package scripts", () => {
  it("surfaces package schema failures instead of falling back to an empty package contract", () => {
    let schemaError: unknown;

    try {
      parsePackageJson('{"scripts":{"dev":false}}');
    } catch (error) {
      schemaError = error;
    }

    expect(isSchemaParseError(schemaError)).toBe(true);
  });

  it("parses static package contract fields", () => {
    const packageJson = readPackageJson();

    expect(packageJson.private).toBe(true);

    expect(
      parse(PackageJsonSchema, {
        engines: {
          node: ">=20",
          pnpm: ">=10",
        },
      }).engines,
    ).toEqual({
      node: ">=20",
      pnpm: ">=10",
    });
  });

  it("rejects arrays at package object and nested record boundaries", () => {
    const arrayInput: unknown = [];
    const nestedRecordArrayInput: unknown = { scripts: ["x"] };

    expect(is(PackageJsonSchema, arrayInput)).toBe(false);
    expect(is(PackageJsonSchema, nestedRecordArrayInput)).toBe(false);
    expect(
      parse(PackageJsonSchema, {
        scripts: { build: "pnpm build" },
      }).scripts,
    ).toEqual({ build: "pnpm build" });
  });

  it("keeps markdown format and lint task globs aligned with env definitions", () => {
    const miseToml = readMiseTaskCorpus();
    const markdownEnv = extractMiseEnvMap(miseToml, "MD_");
    const markdownTargets = extractMiseEnvValues(miseToml, "MD_");
    const markdownEnvNames = [...markdownEnv.keys()];
    const markdownTaskCommands = [
      { commandName: "run", expectedRefs: markdownEnvNames.map((key) => `$${key}`), taskName: "format:md" },
      { commandName: "run_windows", expectedRefs: markdownEnvNames.map((key) => `$env:${key}`), taskName: "format:md" },
      { commandName: "run", expectedRefs: markdownEnvNames.map((key) => `$${key}`), taskName: "lint:md" },
      { commandName: "run_windows", expectedRefs: markdownEnvNames.map((key) => `$env:${key}`), taskName: "lint:md" },
    ] as const;

    for (const { commandName, expectedRefs, taskName } of markdownTaskCommands) {
      const targets = extractMarkdownTaskTargets(miseToml, taskName, commandName);

      expect(targets).toEqual(expectedRefs);
      expect(resolveMiseEnvReferences(targets, markdownEnv)).toEqual(markdownTargets);
    }
  });

  it("keeps mise-routed tool dependencies explicit in the knip contract", () => {
    const packageJson = readPackageJson();
    const miseToml = readMiseTaskCorpus();

    expect(packageJson.devDependencies?.["markdownlint-cli2"]).toBeDefined();
    expect(packageJson.devDependencies?.wrangler).toBeDefined();

    expect(extractMarkdownlintInvocation(extractMiseTaskCommand(miseToml, "format:md", "run"))).toEqual([
      "markdownlint-cli2",
    ]);
    expect(extractMarkdownlintInvocation(extractMiseTaskCommand(miseToml, "lint:md", "run"))).toEqual([
      "markdownlint-cli2",
    ]);
    expect(extractMarkdownlintInvocation(extractMiseTaskCommand(miseToml, "format:md", "run_windows"))).toEqual([
      "markdownlint-cli2",
    ]);
    expect(extractMarkdownlintInvocation(extractMiseTaskCommand(miseToml, "lint:md", "run_windows"))).toEqual([
      "markdownlint-cli2",
    ]);
  });

  it("adds portless entrypoints for browser development and storybook", () => {
    const packageJson = readPackageJson();

    expect(packageJson.devDependencies?.portless).toBeDefined();
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
    const miseToml = readMiseTaskCorpus();
    const miseTasks = extractMiseTaskNames(miseToml);

    expect(miseTasks.has("test:storybook:e2e")).toBe(true);
    expect(miseTasks.has("build:storybook")).toBe(true);
  });

  it("keeps Vitest unit test projects addressable from package and mise tasks", () => {
    const miseToml = readMiseTaskCorpus();
    const fastTask = extractMiseTaskSection(miseToml, "test:unit:fast");
    const fastWindowsCommand = extractMiseTaskCommand(miseToml, "test:unit:fast", "run_windows");
    const domTask = extractMiseTaskSection(miseToml, "test:unit:dom");
    const domWindowsCommand = extractMiseTaskCommand(miseToml, "test:unit:dom", "run_windows");
    const ciTask = extractMiseTaskSection(miseToml, "test:unit:ci");
    const ciWindowsCommand = extractMiseTaskCommand(miseToml, "test:unit:ci", "run_windows");
    const ciNodeTask = extractMiseTaskSection(miseToml, "test:unit:ci:node");
    const ciNodeWindowsCommand = extractMiseTaskCommand(miseToml, "test:unit:ci:node", "run_windows");
    const ciDomTask = extractMiseTaskSection(miseToml, "test:unit:ci:dom");
    const ciDomWindowsCommand = extractMiseTaskCommand(miseToml, "test:unit:ci:dom", "run_windows");
    const profileTask = extractMiseTaskSection(miseToml, "test:unit:profile");
    const profileWindowsCommand = extractMiseTaskCommand(miseToml, "test:unit:profile", "run_windows");
    const parallelProfileTask = extractMiseTaskSection(miseToml, "test:unit:parallel:profile");
    const parallelProfileWindowsCommand = extractMiseTaskCommand(miseToml, "test:unit:parallel:profile", "run_windows");

    expect(fastTask).not.toBe("");
    expect(fastTask).toContain("vitest run --project node");
    expect(fastTask).not.toContain("test:jsdom");
    expect(fastWindowsCommand).toBe("");
    expect(domTask).not.toBe("");
    expect(domTask).toContain("vitest run --project jsdom");
    expect(domTask).not.toContain("test:node");
    expect(domWindowsCommand).toBe("");
    expect(ciTask).not.toBe("");
    expect(ciTask).toContain("mise run test:unit:ci:node");
    expect(ciTask).toContain("mise run test:unit:ci:dom");
    expect(ciWindowsCommand).toContain("mise run test:unit:ci:node");
    expect(ciWindowsCommand).toContain("mise run test:unit:ci:dom");
    expect(ciNodeTask).not.toBe("");
    expect(ciNodeTask).toContain("vitest run --project node --reporter=dot --silent=passed-only");
    expect(ciNodeWindowsCommand).toBe("");
    expect(ciDomTask).not.toBe("");
    expect(ciDomTask).toContain("vitest run --project jsdom --reporter=dot --silent=passed-only");
    expect(ciDomWindowsCommand).toBe("");
    expect(profileTask).not.toBe("");
    expect(profileTask).toContain("vitest run --project node --reporter=verbose --slow-test-threshold=300");
    expect(profileTask).toContain("vitest run --project jsdom --reporter=verbose --slow-test-threshold=300");
    expect(profileWindowsCommand).toContain("vitest run --project node --reporter=verbose --slow-test-threshold=300");
    expect(profileWindowsCommand).toContain("vitest run --project jsdom --reporter=verbose --slow-test-threshold=300");
    expect(parallelProfileTask).not.toBe("");
    expect(parallelProfileTask).toContain("vitest run --reporter=dot --silent=passed-only");
    expect(parallelProfileWindowsCommand).toBe("");
  });

  it("exposes Tauri Vite manager check mode through mise", () => {
    const miseToml = readMiseTaskCorpus();
    const miseTasks = extractMiseTaskNames(miseToml);

    expect(miseTasks.has("app:dev:vite-check")).toBe(true);
  });

  it("keeps Tauri dev tasks on portable thin node commands", () => {
    const miseToml = readMiseTaskCorpus();
    const tauriDevTasks = ["app:dev", "app:dev:native-keyring", "app:dev:subscriptions-index", "app:dev:web-preview"];

    for (const taskName of tauriDevTasks) {
      const taskSection = extractMiseTaskSection(miseToml, taskName);

      expect(extractMiseTaskCommand(miseToml, taskName, "run_windows")).toBe("");
      expect(taskSection).not.toContain('shell = "powershell.exe');
      expect(taskSection).not.toContain("windows-dev-env");
      expect(taskSection).not.toContain("%SystemRoot%");
      expect(taskSection).not.toContain("WindowsPowerShell");
    }

    const viteCheckSection = extractMiseTaskSection(miseToml, "app:dev:vite-check");

    expect(extractMiseTaskCommand(miseToml, "app:dev:vite-check", "run_windows")).toBe("");
    expect(viteCheckSection).not.toContain('shell = "powershell.exe');
    expect(viteCheckSection).not.toContain("windows-dev-env");
    expect(viteCheckSection).not.toContain("%SystemRoot%");
    expect(viteCheckSection).not.toContain("WindowsPowerShell");
  });

  it("keeps README mise commands backed by mise tasks", () => {
    const readmeCommands = extractReadmeMiseCommands(readWorkspaceFile("README.md"));
    const miseTasks = extractMiseTaskNames(readMiseTaskCorpus());

    expect(readmeCommands.filter((command) => !miseTasks.has(command))).toEqual([]);
  });
});
