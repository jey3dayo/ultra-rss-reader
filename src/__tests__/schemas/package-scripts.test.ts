import { readFileSync } from "node:fs";
import { resolve } from "node:path";
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
  return ["mise.toml", "mise/format.toml", "mise/lint.toml", "mise/quality.toml", "mise/test.toml"]
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

function extractMiseTaskDepends(miseToml: string, taskName: string): string[] {
  const taskSection = extractMiseTaskSection(miseToml, taskName);
  const dependsLine = taskSection.match(/^depends = \[(.*)\]$/m)?.[1] ?? "";

  return [...dependsLine.matchAll(/"([^"]+)"/g)].map((match) => match[1] ?? "");
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

function extractMiseToolVersion(miseToml: string, toolName: string): string | null {
  const escapedToolName = toolName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return miseToml.match(new RegExp(`^(?:"${escapedToolName}"|${escapedToolName})\\s*=\\s*"([^"]+)"`, "m"))?.[1] ?? null;
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
    const windowsEnvName = arg.match(/^%([A-Z0-9_]+)%$/)?.[1];
    const envName = posixEnvName ?? windowsEnvName;

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

function extractPackageManagerVersion(packageManager: string | undefined, managerName: string): string | null {
  return packageManager?.match(new RegExp(`^${managerName}@(.+)$`))?.[1] ?? null;
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

  it("parses static package contract fields without mixing engine parity checks", () => {
    const packageJson = readPackageJson();

    expect(packageJson.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(packageJson.packageManager).toBe("pnpm@11.9.0");
    expect(packageJson.private).toBe(true);
    expect(packageJson.type).toBe("module");

    expect(
      PackageJsonSchema.parse({
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

  it("keeps package engines aligned with mise tools and packageManager", () => {
    const packageJson = readPackageJson();
    const miseToml = readMiseTaskCorpus();
    const packageManagerVersion = extractPackageManagerVersion(packageJson.packageManager, "pnpm");

    expect(packageJson.engines?.node).toBe(extractMiseToolVersion(miseToml, "node"));
    expect(packageJson.engines?.pnpm).toBe(extractMiseToolVersion(miseToml, "npm:pnpm"));
    expect(packageJson.engines?.pnpm).toBe(packageManagerVersion);
    expect(extractMiseToolVersion(miseToml, "npm:npm-check-updates")).toBe("22.2.9");
  });

  it("keeps markdown format and lint task globs aligned with env definitions", () => {
    const miseToml = readMiseTaskCorpus();
    const markdownEnv = extractMiseEnvMap(miseToml, "MD_");
    const markdownTargets = extractMiseEnvValues(miseToml, "MD_");
    const markdownEnvNames = [...markdownEnv.keys()];
    const markdownTaskCommands = [
      { commandName: "run", expectedRefs: markdownEnvNames.map((key) => `$${key}`), taskName: "format:md" },
      { commandName: "run_windows", expectedRefs: markdownEnvNames.map((key) => `%${key}%`), taskName: "format:md" },
      { commandName: "run", expectedRefs: markdownEnvNames.map((key) => `$${key}`), taskName: "lint:md" },
      { commandName: "run_windows", expectedRefs: markdownEnvNames.map((key) => `%${key}%`), taskName: "lint:md" },
    ] as const;

    expect(markdownTargets).toEqual([
      "**/*.md",
      "#**/node_modules/**",
      "#**/.pnpm-store/**",
      "#**/.worktrees/**",
      "#**/target/**",
      "#src-tauri/gen/**",
    ]);
    for (const { commandName, expectedRefs, taskName } of markdownTaskCommands) {
      const targets = extractMarkdownTaskTargets(miseToml, taskName, commandName);

      expect(targets).toEqual(expectedRefs);
      expect(resolveMiseEnvReferences(targets, markdownEnv)).toEqual(markdownTargets);
    }
  });

  it("keeps markdownlint-cli2 routed through mise tasks for the knip dependency contract", () => {
    const packageJson = readPackageJson();
    const miseToml = readMiseTaskCorpus();

    expect(packageJson.devDependencies?.["markdownlint-cli2"]).toBeDefined();
    expect(packageJson.knip?.ignoreDependencies).toEqual(["markdownlint-cli2"]);

    expect(extractMarkdownlintInvocation(extractMiseTaskCommand(miseToml, "format:md", "run"))).toEqual([
      "markdownlint-cli2",
    ]);
    expect(extractMarkdownlintInvocation(extractMiseTaskCommand(miseToml, "lint:md", "run"))).toEqual([
      "markdownlint-cli2",
    ]);
    expect(extractMarkdownlintInvocation(extractMiseTaskCommand(miseToml, "format:md", "run_windows"))).toEqual([
      "markdownlint-cli2.CMD",
    ]);
    expect(extractMarkdownlintInvocation(extractMiseTaskCommand(miseToml, "lint:md", "run_windows"))).toEqual([
      "markdownlint-cli2.CMD",
    ]);
  });

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
    const miseToml = readMiseTaskCorpus();
    const miseTasks = extractMiseTaskNames(miseToml);

    expect(packageJson.scripts?.["test:storybook:e2e"]).toBe(
      "pnpm exec playwright test --config playwright.storybook.config.ts",
    );
    expect(packageJson.scripts?.["build-storybook"]).toBe("storybook build");
    expect(miseTasks.has("test:storybook:e2e")).toBe(true);
    expect(miseTasks.has("build:storybook")).toBe(true);
    expect(miseToml).toContain("playwright test --config playwright.storybook.config.ts");
    expect(miseToml).toContain("storybook build");
  });

  it("exposes dependency license inventory generation through package scripts", () => {
    const packageJson = readPackageJson();

    expect(packageJson.scripts?.["quality:dependency-licenses"]).toBe(
      "node ./scripts/quality-baseline.ts dependency-licenses",
    );
  });

  it("exposes macOS Keychain signature diagnostics through package scripts", () => {
    const packageJson = readPackageJson();
    const diagnosticScript = readWorkspaceFile("scripts/release/macos-keychain-signature-diagnostics.ts");

    expect(packageJson.scripts?.["diagnose:macos-keychain-signature"]).toBe(
      "node ./scripts/release/macos-keychain-signature-diagnostics.ts",
    );
    expect(diagnosticScript).toContain("record [--app <path>]");
    expect(diagnosticScript).toContain("compare --before <old.json> --after <new.json>");
    expect(diagnosticScript).toContain('const KEYCHAIN_SERVICE = "ultra-rss-reader"');
    expect(diagnosticScript).toContain('ignoredFields: ["cdHash"]');
  });

  it("keeps Vitest unit test projects addressable from package and mise tasks", () => {
    const packageJson = readPackageJson();
    const miseToml = readMiseTaskCorpus();
    const vitestConfig = readWorkspaceFile("vitest.config.ts");
    const fastTask = extractMiseTaskSection(miseToml, "test:unit:fast");
    const fastWindowsCommand = extractMiseTaskCommand(miseToml, "test:unit:fast", "run_windows");
    const domTask = extractMiseTaskSection(miseToml, "test:unit:dom");
    const domWindowsCommand = extractMiseTaskCommand(miseToml, "test:unit:dom", "run_windows");
    const ciTask = extractMiseTaskSection(miseToml, "test:unit:ci");
    const ciWindowsCommand = extractMiseTaskCommand(miseToml, "test:unit:ci", "run_windows");
    const profileTask = extractMiseTaskSection(miseToml, "test:unit:profile");
    const profileWindowsCommand = extractMiseTaskCommand(miseToml, "test:unit:profile", "run_windows");
    const parallelProfileTask = extractMiseTaskSection(miseToml, "test:unit:parallel:profile");
    const parallelProfileWindowsCommand = extractMiseTaskCommand(miseToml, "test:unit:parallel:profile", "run_windows");

    expect(packageJson.scripts?.test).toBe("pnpm run test:node && pnpm run test:jsdom");
    expect(packageJson.scripts?.["test:node"]).toBe("pnpm exec vitest run --project node");
    expect(packageJson.scripts?.["test:jsdom"]).toBe("pnpm exec vitest run --project jsdom");
    expect(vitestConfig).toContain('"src/**/*.node.test.{ts,tsx}"');
    expect(vitestConfig).toContain('"tests/**/*.node.test.{ts,tsx}"');
    expect(vitestConfig).toContain("...nodeNamedTestGlobs");
    expect(fastTask).not.toBe("");
    expect(fastTask).toContain("vitest run --project node");
    expect(fastTask).not.toContain("test:jsdom");
    expect(fastWindowsCommand).toContain("vitest.CMD run --project node");
    expect(domTask).not.toBe("");
    expect(domTask).toContain("vitest run --project jsdom");
    expect(domTask).not.toContain("test:node");
    expect(domWindowsCommand).toContain("vitest.CMD run --project jsdom");
    expect(ciTask).not.toBe("");
    expect(ciTask).toContain("vitest run --project node --reporter=dot --silent=passed-only");
    expect(ciTask).toContain("vitest run --project jsdom --reporter=dot --silent=passed-only");
    expect(ciWindowsCommand).toContain("pnpm.CMD run test:node --reporter=dot --silent=passed-only");
    expect(ciWindowsCommand).toContain("pnpm.CMD run test:jsdom --reporter=dot --silent=passed-only");
    expect(profileTask).not.toBe("");
    expect(profileTask).toContain("vitest run --project node --reporter=verbose --slow-test-threshold=300");
    expect(profileTask).toContain("vitest run --project jsdom --reporter=verbose --slow-test-threshold=300");
    expect(profileWindowsCommand).toContain("pnpm.CMD run test:node --reporter=verbose --slow-test-threshold=300");
    expect(profileWindowsCommand).toContain("pnpm.CMD run test:jsdom --reporter=verbose --slow-test-threshold=300");
    expect(parallelProfileTask).not.toBe("");
    expect(parallelProfileTask).toContain("vitest run --reporter=dot --silent=passed-only");
    expect(parallelProfileWindowsCommand).toContain("pnpm.CMD exec vitest run --reporter=dot --silent=passed-only");
  });

  it("keeps mise test:all semantics aligned with Storybook E2E", () => {
    const miseToml = readMiseTaskCorpus();

    expect(extractMiseTaskDepends(miseToml, "test:all")).toEqual([
      "test:rust",
      "test:unit",
      "test:e2e",
      "test:storybook:e2e",
    ]);
  });

  it("exposes Tauri Vite manager check mode through mise", () => {
    const miseToml = readMiseTaskCorpus();
    const miseTasks = extractMiseTaskNames(miseToml);

    expect(readWorkspaceFile("scripts/tauri-dev-vite-manager.ts")).toContain('args.includes("--check")');
    expect(miseTasks.has("app:dev:vite-check")).toBe(true);
    expect(miseToml).toContain("node ./scripts/tauri-dev-vite-manager.ts --check");
  });

  it("keeps Tauri dev tasks on portable thin node commands", () => {
    const miseToml = readMiseTaskCorpus();
    const tauriDevTasks = ["app:dev", "app:dev:native-keyring", "app:dev:subscriptions-index", "app:dev:web-preview"];

    for (const taskName of tauriDevTasks) {
      const taskSection = extractMiseTaskSection(miseToml, taskName);

      expect(extractMiseTaskCommand(miseToml, taskName, "run_windows")).toBe(
        "node ./scripts/tauri-cli-dispatch.ts dev -c src-tauri/tauri.dev.conf.json",
      );
      expect(taskSection).not.toContain('shell = "powershell.exe');
      expect(taskSection).not.toContain("windows-dev-env");
      expect(taskSection).not.toContain("%SystemRoot%");
      expect(taskSection).not.toContain("WindowsPowerShell");
    }

    const viteCheckSection = extractMiseTaskSection(miseToml, "app:dev:vite-check");

    expect(extractMiseTaskCommand(miseToml, "app:dev:vite-check", "run_windows")).toBe(
      "node ./scripts/tauri-dev-vite-manager.ts --check",
    );
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

  it("keeps local app install docs separate from published release verification", () => {
    const readme = readWorkspaceFile("README.md");
    const miseToml = readMiseTaskCorpus();
    const releaseManual = readWorkspaceFile("docs/release-manual-verification.md");

    expect(miseToml).toContain(
      'description = "Build, locally re-sign, and install the current checkout; not a published release artifact verification"',
    );
    expect(readme).toContain(
      "mise run app:install  # Build, locally re-sign, and install the current checkout; not published release verification",
    );
    expect(readme).toContain("Published release install verification must use the artifact from GitHub Releases");
    expect(releaseManual).toContain("### 2. Published Release Install Verification");
    expect(releaseManual).toContain("Release asset digest");
    expect(releaseManual).toContain("Codesign result");
    expect(releaseManual).toContain("Gatekeeper result");
    expect(releaseManual).toContain("Do not use `mise run app:install` for this step.");
    expect(releaseManual).toContain("not evidence that the published release artifact");
    expect(releaseManual).toContain("### 3a. macOS Keychain Re-Prompt Signature Diagnostics");
    expect(releaseManual).toContain("Do not use `mise run app:install`, `mise run app:dev:native-keyring`");
    expect(releaseManual).toContain("pnpm run diagnose:macos-keychain-signature -- record");
    expect(releaseManual).toContain("pnpm run diagnose:macos-keychain-signature -- compare");
    expect(releaseManual).toContain("`CDHash` is recorded but ignored");
    expect(releaseManual).toContain("service `ultra-rss-reader`");
  });
});
