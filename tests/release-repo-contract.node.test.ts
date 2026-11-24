import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { checkReleaseBuildSources } from "../scripts/check-release-build-contamination";
import { qualityBaselineRepoScanIgnoredPathPrefixes } from "../scripts/quality-baseline";
import {
  RELEASE_UPDATER_ASSET_CONTRACT as actualReleaseUpdaterAssetContract,
  UNSUPPORTED_UPDATER_PLATFORM_KEYS as actualUnsupportedUpdaterPlatformKeys,
} from "../scripts/release/lib/artifact-contract";
import { type ReleaseConfigSources, validateReleaseConfigSources } from "../scripts/release/lib/config-validation";
import {
  analyzeRepositorySqlInventory,
  buildEnumDriftRows,
  type EnumDriftContract,
  formatEnumDriftTable,
  formatRepositorySqlInventoryReport,
  readMigrationSources,
} from "../scripts/repo-contract-inventory";
import { APP_ACTIONS, getAppActionUnavailableReason } from "../src/lib/app-actions";
import {
  generatedFixtureSnapshotSizeBudget,
  isGeneratedReportArtifactPath,
  liveProviderTestGateContract,
  markdownlintRepoContract,
} from "./helpers/quality-baseline-repo-contract";
import {
  extractYamlInlineListValues,
  extractYamlLabelsFields,
  extractYamlTopLevelKeys,
} from "./helpers/repo-contract-parser";

type PackageJson = {
  name: string;
  private: boolean;
  scripts: Record<string, string>;
  version: string;
  engines: {
    node: string;
  };
};

type TauriConfig = {
  productName: string;
  version: string;
  identifier: string;
  app?: {
    security?: {
      csp?: string;
    };
  };
  build?: {
    devUrl?: string;
  };
  bundle?: {
    createUpdaterArtifacts?: boolean;
    icon?: string[];
  };
  plugins?: {
    updater?: {
      endpoints?: string[];
      pubkey?: string;
    };
  };
};

type TauriCapability = {
  identifier: string;
  webviews?: string[];
  permissions?: CapabilityPermission[];
};

type CapabilityPermission =
  | string
  | {
      identifier: string;
      allow?: Array<{ url: string }>;
      deny?: Array<{ url: string }>;
    };

type TauriCapabilityFile =
  | TauriCapability
  | TauriCapability[]
  | {
      capabilities: TauriCapability[];
    };

type MigrationChangelogEntry = {
  description: string;
  destructive: boolean;
  fileName: string;
  owner: string;
  version: number;
};

const RELEASE_UPDATER_ENDPOINT = "https://github.com/jey3dayo/ultra-rss-reader/releases/latest/download/latest.json";
const RELEASE_TAURI_CONFIG_PATH = "src-tauri/tauri.release.conf.json";
const DEV_TAURI_CONFIG_PATH = "src-tauri/tauri.dev.conf.json";
const PROD_TAURI_IDENTIFIER = "com.jey3dayo.ultra-rss-reader";
const DEV_TAURI_IDENTIFIER = "com.ultra-rss-reader.dev";
const MIGRATION_DIR = "src-tauri/migrations";
const INLINE_MIGRATION_VERSIONS: readonly number[] = [10];
const DESTRUCTIVE_MIGRATION_MARKER = "-- destructive-migration:";
const MIGRATION_OWNER_BY_DESCRIPTION_PATTERN = [
  [/^initial$/, "db"],
  [/^db_/, "db"],
  [/^fts5$/, "article-search"],
  [/^preferences$|_preferences$/, "preferences"],
  [/^tags$|tag_/, "tags"],
  [/^feed_/, "feeds"],
  [/^reader_/, "reader"],
  [/^account_/, "accounts"],
  [/^local_account_sync_/, "local-account-sync"],
  [/^folder_/, "folders"],
  [/^sync_/, "sync"],
  [/^reset_empty_freshrss_feed_sync_state$/, "sync"],
  [/^mute_/, "mute-keywords"],
  [/^article_|^sanitizer_version_/, "articles"],
  [/^remove_inoreader$/, "accounts"],
] as const;
const PACKAGED_WINDOW_ICON_PATHS = [
  "icons/32x32.png",
  "icons/128x128.png",
  "icons/128x128@2x.png",
  "icons/icon.icns",
  "icons/icon.ico",
  "icons/Assets.car",
] as const;
const MOBILE_ICON_ASSET_PATHS = [
  "icons/android/mipmap-anydpi-v26/ic_launcher.xml",
  "icons/android/mipmap-hdpi/ic_launcher.png",
  "icons/android/mipmap-hdpi/ic_launcher_foreground.png",
  "icons/android/mipmap-hdpi/ic_launcher_round.png",
  "icons/android/mipmap-mdpi/ic_launcher.png",
  "icons/android/mipmap-mdpi/ic_launcher_foreground.png",
  "icons/android/mipmap-mdpi/ic_launcher_round.png",
  "icons/android/mipmap-xhdpi/ic_launcher.png",
  "icons/android/mipmap-xhdpi/ic_launcher_foreground.png",
  "icons/android/mipmap-xhdpi/ic_launcher_round.png",
  "icons/android/mipmap-xxhdpi/ic_launcher.png",
  "icons/android/mipmap-xxhdpi/ic_launcher_foreground.png",
  "icons/android/mipmap-xxhdpi/ic_launcher_round.png",
  "icons/android/mipmap-xxxhdpi/ic_launcher.png",
  "icons/android/mipmap-xxxhdpi/ic_launcher_foreground.png",
  "icons/android/mipmap-xxxhdpi/ic_launcher_round.png",
  "icons/android/values/ic_launcher_background.xml",
  "icons/ios/AppIcon-20x20@1x.png",
  "icons/ios/AppIcon-20x20@2x-1.png",
  "icons/ios/AppIcon-20x20@2x.png",
  "icons/ios/AppIcon-20x20@3x.png",
  "icons/ios/AppIcon-29x29@1x.png",
  "icons/ios/AppIcon-29x29@2x-1.png",
  "icons/ios/AppIcon-29x29@2x.png",
  "icons/ios/AppIcon-29x29@3x.png",
  "icons/ios/AppIcon-40x40@1x.png",
  "icons/ios/AppIcon-40x40@2x-1.png",
  "icons/ios/AppIcon-40x40@2x.png",
  "icons/ios/AppIcon-40x40@3x.png",
  "icons/ios/AppIcon-512@2x.png",
  "icons/ios/AppIcon-60x60@2x.png",
  "icons/ios/AppIcon-60x60@3x.png",
  "icons/ios/AppIcon-76x76@1x.png",
  "icons/ios/AppIcon-76x76@2x.png",
  "icons/ios/AppIcon-83.5x83.5@2x.png",
] as const;
const UPDATER_PUBKEY_PLACEHOLDER_PATTERN = /(?:placeholder|change[_-]?me|todo)/i;
const RELEASE_UPDATER_ASSET_CONTRACT = [
  {
    assetPattern: ".app.tar.gz",
    artifactArch: "aarch64",
    artifactPlatform: "darwin",
    checksumPattern: ".app.tar.gz.sha256",
    matrixArgs: "--target aarch64-apple-darwin",
    matrixPlatform: "macos-latest",
    cargoTarget: "aarch64-apple-darwin",
    platformKey: "darwin-aarch64",
    signaturePattern: ".app.tar.gz.sig",
  },
  {
    assetPattern: "-setup.exe",
    artifactArch: "x86_64",
    artifactPlatform: "windows",
    checksumPattern: "-setup.exe.sha256",
    matrixArgs: '""',
    matrixPlatform: "windows-latest",
    cargoTarget: "x86_64-pc-windows-msvc",
    platformKey: "windows-x86_64",
    signaturePattern: "-setup.exe.sig",
  },
] as const;
const UNSUPPORTED_UPDATER_PLATFORM_KEYS = ["linux-x86_64", "linux-aarch64"] as const;
const REQUIRED_RELEASE_CSP_DIRECTIVES = {
  "script-src": ["'self'"],
  "style-src": ["'self'", "'unsafe-inline'"],
  "connect-src": ["ipc:", "http://ipc.localhost"],
  "font-src": ["'self'"],
} as const;
const RELEASE_CSP_FORBIDDEN_SOURCES = [
  "*",
  "'unsafe-eval'",
  "http://localhost:1420",
  "http://127.0.0.1:1420",
  "ws://localhost:1421",
  "ws://127.0.0.1:1421",
] as const;

const readText = (path: string): string => readFileSync(path, "utf8");
const readRustModuleSource = (path: string): string => {
  const siblingTestsPath = path.replace(/\.rs$/, "/tests.rs");
  return existsSync(siblingTestsPath) ? `${readText(path)}\n${readText(siblingTestsPath)}` : readText(path);
};
const readUpdaterModuleSource = (): string =>
  ["mod.rs", "state.rs", "policy.rs", "tests.rs"]
    .map((file) => readText(`src-tauri/src/commands/updater_commands/${file}`))
    .join("\n");
const readTauriLibSource = (): string => {
  const rustFilesIn = (dir: string): string[] =>
    readdirSync(`src-tauri/src/${dir}`)
      .filter((file) => file.endsWith(".rs"))
      .sort()
      .map((file) => `src-tauri/src/${dir}/${file}`);
  return ["src-tauri/src/lib.rs", ...rustFilesIn("startup"), ...rustFilesIn("tests")]
    .map((file) => readText(file))
    .join("\n");
};
const readMigrationModuleSource = (): string => {
  const migrationDir = "src-tauri/src/infra/db/migration";
  const migrationTestFiles = readdirSync(`${migrationDir}/tests`)
    .filter((file) => file.endsWith(".rs"))
    .sort()
    .map((file) => `tests/${file}`);
  return ["mod.rs", "consts.rs", "repairs.rs", ...migrationTestFiles]
    .map((file) => readText(`${migrationDir}/${file}`))
    .join("\n");
};
const readGReaderProviderModuleSource = (): string =>
  [
    "mod.rs",
    "http.rs",
    "http/responses.rs",
    "http/api_calls.rs",
    "stream.rs",
    "stream_subscriptions.rs",
    "stream_types.rs",
    "tests.rs",
  ]
    .map((file) => readText(`src-tauri/src/infra/provider/greader/${file}`))
    .join("\n");
const readMiseTaskCorpus = (): string =>
  ["mise.toml", "mise/format.toml", "mise/lint.toml", "mise/quality.toml", "mise/test.toml"].map(readText).join("\n");
const readReleaseSkillCorpus = (): string =>
  [
    ".codex/skills/release/SKILL.md",
    ".codex/skills/release/references/phase-1-prechecks.md",
    ".codex/skills/release/references/phase-2-generate.md",
    ".codex/skills/release/references/phase-3-publish.md",
    ".codex/skills/release/references/subagents.md",
  ]
    .map((path) => readText(path))
    .join("\n");

const runWorkflowPinChecker = (workflowsDir: string): string =>
  execFileSync("node", ["scripts/check-workflow-pins.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {
      ...process.env,
      WORKFLOW_PINS_WORKFLOWS_DIR: workflowsDir,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const decodeTomlBasicString = (value: string): string =>
  value.replace(/\\(u[0-9a-fA-F]{4}|U[0-9a-fA-F]{8}|["\\btnfr])/g, (match, token: string) => {
    if (token === "b") return "\b";
    if (token === "t") return "\t";
    if (token === "n") return "\n";
    if (token === "f") return "\f";
    if (token === "r") return "\r";
    if (token === '"') return '"';
    if (token === "\\") return "\\";
    if (token.startsWith("u") || token.startsWith("U")) {
      return String.fromCodePoint(Number.parseInt(token.slice(1), 16));
    }
    return match;
  });

const readTomlMultilineString = (
  lines: string[],
  startLineIndex: number,
  rest: string,
  delimiter: '"""' | "'''",
): string => {
  let value = rest.slice(delimiter.length);
  let lineIndex = startLineIndex;

  while (lineIndex < lines.length) {
    const closeIndex = value.indexOf(delimiter);
    if (closeIndex >= 0) {
      const content = value.slice(0, closeIndex);
      return content.startsWith("\n") ? content.slice(1) : content;
    }

    lineIndex += 1;
    if (lineIndex < lines.length) {
      value += `\n${lines[lineIndex]}`;
    }
  }

  throw new Error("Unterminated TOML multiline string");
};

const readTomlBasicString = (rest: string): string => {
  let escaped = false;
  for (let index = 1; index < rest.length; index += 1) {
    const char = rest[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === '"') {
      return rest.slice(1, index);
    }
  }

  throw new Error("Unterminated TOML basic string");
};

const extractTomlString = (source: string, key: string): string => {
  const lines = source.split(/\r?\n/);
  const keyPattern = new RegExp(`^${escapeRegExp(key)}\\s*=\\s*(?<rest>.*)$`);

  for (let index = 0; index < lines.length; index += 1) {
    const rest = lines[index].match(keyPattern)?.groups?.rest.trimStart();
    if (!rest) {
      continue;
    }
    if (rest.startsWith('"""')) {
      return decodeTomlBasicString(readTomlMultilineString(lines, index, rest, '"""'));
    }
    if (rest.startsWith("'''")) {
      return readTomlMultilineString(lines, index, rest, "'''");
    }
    if (rest.startsWith('"')) {
      return decodeTomlBasicString(readTomlBasicString(rest));
    }
    if (rest.startsWith("'")) {
      const closeIndex = rest.indexOf("'", 1);
      if (closeIndex < 0) {
        throw new Error(`Unterminated TOML literal string: ${key}`);
      }
      return rest.slice(1, closeIndex);
    }
  }

  throw new Error(`Missing TOML string: ${key}`);
};

const parseCspDirectives = (csp: string): Map<string, string[]> => {
  const directives = new Map<string, string[]>();

  for (const directive of csp.split(";")) {
    const [name, ...sources] = directive.trim().split(/\s+/);
    if (name) {
      directives.set(name, sources);
    }
  }

  return directives;
};

const extractWorkflowStepBlocks = (workflow: string): string[] => {
  const stepStart = /^\s{6}- (?:name|uses|run):/;
  const lines = workflow.split("\n");
  const blocks: string[] = [];
  let current: string[] | null = null;

  for (const line of lines) {
    if (stepStart.test(line)) {
      if (current) {
        blocks.push(current.join("\n"));
      }
      current = [line];
      continue;
    }
    current?.push(line);
  }
  if (current) {
    blocks.push(current.join("\n"));
  }
  return blocks;
};

const extractTaskBlock = (source: string, taskName: string): string => {
  const escapedTaskName = escapeRegExp(taskName);
  const value = source.match(
    new RegExp(
      `(?:\\[tasks\\."${escapedTaskName}"\\]|\\["${escapedTaskName}"\\])\\n(?<block>[\\s\\S]*?)(?=\\n(?:\\[tasks\\.|\\["[^"]+"\\])|$)`,
    ),
  )?.groups?.block;
  if (!value) {
    throw new Error(`Missing mise task block: ${taskName}`);
  }
  return value;
};

const extractWorkflowLockEntries = (lockfile: string, workflowFile: string): string[] => {
  const section = lockfile.match(
    new RegExp(`'\\.github/workflows/${escapeRegExp(workflowFile)}':\\n(?<entries>(?: {8}- '[^']+'\\n)+)`),
  )?.groups?.entries;
  if (!section) {
    throw new Error(`Missing actions.lock entries for ${workflowFile}`);
  }
  return [...section.matchAll(/- '([^']+)'/g)].map((match) => match[1] ?? "");
};

const extractWorkflowUses = (source: string): string[] => {
  const usesPattern = /^\s*(?:-\s+)?uses:\s+(\S+)(?:\s+#.*)?\s*$/gm;
  return [...source.matchAll(usesPattern)].map((match) => match[1] ?? "");
};

const extractReleaseStepBlock = (source: string, stepName: string): string => {
  const value = source.match(
    new RegExp(`- name: ${escapeRegExp(stepName)}\\n(?<block>[\\s\\S]*?)(?=\\n {6}- (?:name|uses|run):|$)`),
  )?.groups?.block;
  if (!value) {
    throw new Error(`Missing release workflow step: ${stepName}`);
  }
  return value;
};

const normalizeCapabilities = (source: TauriCapabilityFile): TauriCapability[] => {
  if (Array.isArray(source)) {
    return source;
  }
  if ("capabilities" in source) {
    return source.capabilities;
  }
  return [source];
};

const permissionIdentifier = (permission: CapabilityPermission): string =>
  typeof permission === "string" ? permission : permission.identifier;

const extractRustStringConstants = (source: string, suffix: string): Map<string, string> => {
  const constants = new Map<string, string>();
  const pattern = new RegExp(`^const\\s+([A-Z0-9_]+${escapeRegExp(suffix)}):\\s*&str\\s*=\\s*"([^"]+)";`, "gm");
  for (const match of source.matchAll(pattern)) {
    const name = match[1];
    const value = match[2];
    if (name && value) {
      constants.set(name, value);
    }
  }
  return constants;
};

const extractNativeMenuActionContracts = (source: string): Map<string, string> => {
  const menuIds = extractRustStringConstants(source, "_MENU_ID");
  const contracts = new Map<string, string>();
  const pattern = /^\s+([A-Z0-9_]+_MENU_ID)\s*=>\s*Some\("([^"]+)"\),$/gm;
  for (const match of source.matchAll(pattern)) {
    const menuIdConst = match[1];
    const action = match[2];
    const menuId = menuIdConst ? menuIds.get(menuIdConst) : undefined;
    if (menuId && action) {
      contracts.set(menuId, action);
    }
  }
  return contracts;
};

const extractAppActions = (source: string): Set<string> => {
  const registry = source.match(/export const APP_ACTION_REGISTRY = \{(?<body>[\s\S]*?)\n\} as const;/)?.groups?.body;
  if (!registry) {
    throw new Error("Missing APP_ACTION_REGISTRY");
  }
  return new Set(
    [...registry.matchAll(/"([^"]+)"/g)].map((match) => match[1]).filter((value): value is string => !!value),
  );
};

const extractShortcutActionIds = (source: string): Set<string> => {
  const definitions = source.match(/export const shortcutDefinitions: ShortcutDefinition\[] = \[(?<body>[\s\S]*?)\n\];/)
    ?.groups?.body;
  if (!definitions) {
    throw new Error("Missing shortcutDefinitions");
  }
  return new Set(
    [...definitions.matchAll(/^\s+id:\s*"([^"]+)",$/gm)]
      .map((match) => match[1])
      .filter((value): value is string => !!value),
  );
};

const extractRustEnumVariants = (source: string, enumName: string): string[] => {
  const body = source.match(new RegExp(`pub enum ${escapeRegExp(enumName)} \\{(?<body>[\\s\\S]*?)\\n\\}`))?.groups
    ?.body;
  if (!body) {
    throw new Error(`Missing Rust enum: ${enumName}`);
  }
  return body
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/,$/, ""))
    .filter((line) => /^[A-Z][A-Za-z0-9]*$/.test(line));
};

const toSnakeCase = (value: string): string =>
  value
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1_$2")
    .toLowerCase();

const extractTypeScriptStringArray = (source: string, constantName: string): string[] => {
  const body = source.match(new RegExp(`const ${escapeRegExp(constantName)} = \\[(?<body>[\\s\\S]*?)\\] as const`))
    ?.groups?.body;
  if (!body) {
    throw new Error(`Missing TypeScript string array: ${constantName}`);
  }
  return [...body.matchAll(/"([^"]+)"/g)].map((match) => match[1]).filter((value): value is string => !!value);
};

const extractTypeScriptUnionValues = (source: string, typeName: string): string[] => {
  const body = source.match(new RegExp(`type ${escapeRegExp(typeName)} = (?<body>[^;]+);`))?.groups?.body;
  if (!body) {
    throw new Error(`Missing TypeScript union: ${typeName}`);
  }
  return [...body.matchAll(/"([^"]+)"/g)].map((match) => match[1]).filter((value): value is string => !!value);
};

const rustStringValuesFromMatchArm = (source: string, functionName: string): string[] => {
  const body = source.match(new RegExp(`fn ${escapeRegExp(functionName)}[\\s\\S]*?\\{(?<body>[\\s\\S]*?)\\n\\}`))
    ?.groups?.body;
  if (!body) {
    throw new Error(`Missing Rust function: ${functionName}`);
  }
  return [...body.matchAll(/=>\s*"([^"]+)"/g)].map((match) => match[1]).filter((value): value is string => !!value);
};

const extractEnabledServiceKinds = (source: string): string[] =>
  [...source.matchAll(/kind:\s*"(?<kind>Local|FreshRss)",/g)]
    .map((match) => match.groups?.kind)
    .filter((kind): kind is string => !!kind);

const extractTopLevelYamlBlock = (source: string, key: string): string => {
  const value = source.match(new RegExp(`^${escapeRegExp(key)}:\\n(?<block>(?: {2}\\S.*\\n?)*)`, "m"))?.groups?.block;
  if (!value) {
    throw new Error(`Missing top-level YAML block: ${key}`);
  }
  return value;
};

const extractYamlScalarBlockEntries = (block: string): Record<string, string> => {
  const entries: Record<string, string> = {};
  for (const line of block.split(/\r?\n/)) {
    const match = line.match(/^ {2}(?<key>[\w-]+):\s*(?<value>\S.*)$/);
    const key = match?.groups?.key;
    const value = match?.groups?.value;
    if (key && value) {
      entries[key] = value;
    }
  }
  return entries;
};

const extractTauriActionBlock = (source: string): string => {
  const value = source.match(/- uses: tauri-apps\/tauri-action@v0\.6\.2[^\n]*\n(?<block>(?: {8}.+\n?)*)/)?.groups
    ?.block;
  if (!value) {
    throw new Error("Missing release tauri-action block");
  }
  return value;
};

const assertReleaseTokenUseScope = (source: string): void => {
  const bindings = new Map([
    ["name: Reject duplicate or published release builds", "GH_TOKEN: $" + "{{ github.token }}"],
    ["uses: tauri-apps/tauri-action@v0.6.2", "GITHUB_TOKEN: $" + "{{ secrets.GITHUB_TOKEN }}"],
    ...[
      "Upload Linux release provenance",
      "Upload updater asset checksums",
      "Upload release provenance assets",
      "Validate existing draft release assets",
    ].map((name): [string, string] => [`name: ${name}`, "GH_TOKEN: $" + "{{ secrets.GITHUB_TOKEN }}"]),
  ]);
  const seen = new Set<string>();
  for (const step of source.split(/(?=^ {6}- )/m)) {
    const tokenUses = step.match(/secrets\.GITHUB_TOKEN|github\.token/g) ?? [];
    if (tokenUses.length === 0) continue;
    const header = step
      .split("\n")[0]
      .trim()
      .replace(/^- /, "")
      .replace(/\s+#.*$/, "");
    const binding = bindings.get(header);
    if (!binding || seen.has(header)) throw new Error(`GitHub token use is not allowed in step ${header}`);
    const envBlock = step.match(/^ {8}env:\r?\n(?<block>(?: {10}.*(?:\r?\n|$))*)/m)?.groups?.block ?? "";
    const envEntries = extractYamlScalarBlockEntries(envBlock.replace(/^ {8}/gm, ""));
    const separator = binding.indexOf(": ");
    if (tokenUses.length !== 1 || envEntries[binding.slice(0, separator)] !== binding.slice(separator + 2)) {
      throw new Error(`GitHub token binding does not match the allowed env use in step ${header}`);
    }
    seen.add(header);
  }
  expect(seen).toEqual(new Set(bindings.keys()));
};

const repoWalkIgnoredDirectoryNames = new Set([
  ".git",
  ".worktrees",
  "dist",
  "node_modules",
  "playwright-report",
  "storybook-static",
  "target",
  "test-results",
  "tmp",
]);

const normalizeRepoPath = (path: string): string => path.replaceAll("\\", "/").replace(/^\.\//, "");

const listRepoFiles = (dir = "."): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (repoWalkIgnoredDirectoryNames.has(entry.name)) {
      return [];
    }

    const path = dir === "." ? entry.name : `${dir}/${entry.name}`;
    if (entry.isDirectory()) {
      return listRepoFiles(path);
    }
    return entry.isFile() ? [normalizeRepoPath(path)] : [];
  });

const isMarkdownlintIgnoredPath = (path: string): boolean => {
  const normalizedPath = normalizeRepoPath(path);
  const segments = normalizedPath.split("/");
  return (
    markdownlintRepoContract.ignorePatterns.some((pattern) => {
      if (pattern.includes("/")) {
        return normalizedPath === pattern || normalizedPath.startsWith(`${pattern}/`);
      }
      return segments.includes(pattern);
    }) ||
    markdownlintRepoContract.generatedMarkdownIgnorePatterns.some(
      (pattern) => pattern === "src-tauri/gen/**" && normalizedPath.startsWith("src-tauri/gen/"),
    )
  );
};

const parseJsonc = (source: string): unknown => JSON.parse(source.replace(/,\s*([}\]])/g, "$1"));

const parseMigrationFileName = (fileName: string): { description: string; version: number } => {
  const match = fileName.match(/^V(?<version>\d+)__(?<description>[a-z0-9]+(?:_[a-z0-9]+)*)\.sql$/);
  if (!match?.groups) {
    throw new Error(`Invalid migration file name: ${fileName}`);
  }

  return {
    description: match.groups.description,
    version: Number.parseInt(match.groups.version, 10),
  };
};

const migrationOwnerForDescription = (description: string): string => {
  const owner = MIGRATION_OWNER_BY_DESCRIPTION_PATTERN.find(([pattern]) => pattern.test(description))?.[1];
  if (!owner) {
    throw new Error(`Missing migration owner mapping for: ${description}`);
  }
  return owner;
};

const hasDestructiveMigrationSql = (source: string): boolean => {
  const withoutSchemaVersionMetadata = source.replace(/DELETE\s+FROM\s+schema_version\b[^;]*;/gi, "");
  return /\b(?:DROP|DELETE\s+FROM|TRUNCATE)\b/i.test(withoutSchemaVersionMetadata);
};

const generateMigrationChangelog = (): MigrationChangelogEntry[] =>
  readdirSync(MIGRATION_DIR)
    .filter((fileName) => fileName.endsWith(".sql"))
    .map((fileName) => {
      const { description, version } = parseMigrationFileName(fileName);
      const source = readText(`${MIGRATION_DIR}/${fileName}`);
      const destructive = hasDestructiveMigrationSql(source);

      return {
        description,
        destructive,
        fileName,
        owner: migrationOwnerForDescription(description),
        version,
      };
    })
    .sort((a, b) => a.version - b.version);

describe("release repository contract", { timeout: 30_000 }, () => {
  const packageJson: PackageJson = JSON.parse(readText("package.json"));
  const tauriConfig: TauriConfig = JSON.parse(readText("src-tauri/tauri.conf.json"));
  const tauriReleaseConfig: TauriConfig = JSON.parse(readText("src-tauri/tauri.release.conf.json"));
  const tauriDevConfig: TauriConfig = JSON.parse(readText("src-tauri/tauri.dev.conf.json"));
  const defaultCapability: TauriCapabilityFile = JSON.parse(readText("src-tauri/capabilities/default.json"));
  const cargoToml = readText("src-tauri/Cargo.toml");
  const cargoLock = readText("src-tauri/Cargo.lock");
  const releaseWorkflow = readText(".github/workflows/release.yml");
  const storeMsixWorkflow = readText(".github/workflows/store-msix.yml");
  const releaseSourceCli = readText("scripts/release/validate-source.ts");
  const releaseSourceWorkflow = readText("scripts/release/workflows/validate-source.ts");
  const releaseConfigCli = readText("scripts/release/validate-release-config.ts");
  const releaseConfigSources: ReleaseConfigSources = {
    packageJson: readText("package.json"),
    tauriConfig: readText("src-tauri/tauri.conf.json"),
    releaseTauriConfig: readText("src-tauri/tauri.release.conf.json"),
    devTauriConfig: readText("src-tauri/tauri.dev.conf.json"),
    defaultCapability: readText("src-tauri/capabilities/default.json"),
    cargoToml,
    cargoLock,
    releaseWorkflow,
    msixManifest: readText("msix/Package.appxmanifest"),
  };
  const codexReleaseChecks = readText(".codex/skills/release/scripts/release_checks.py");
  const dependencyLicenseReportScript = readText("scripts/report-dependency-licenses.ts");
  const releaseArtifactsCli = readText("scripts/release/artifacts.ts");
  const releaseArtifactWorkflow = readText("scripts/release/workflows/artifacts.ts");
  const releaseContaminationChecker = readText("scripts/check-release-build-contamination.ts");
  const tauriLib = readTauriLibSource();
  const updaterCommandsSource = readUpdaterModuleSource();
  const migrationSource = readMigrationModuleSource();
  const devMocks = readText("src/dev/mocks.ts");
  const incidentRunbook = readText("docs/incident-runbook.md");
  const releaseManualVerification = readText("docs/release-manual-verification.md");
  const ciWorkflow = readText(".github/workflows/ci.yml");
  const labelerWorkflow = readText(".github/workflows/labeler.yml");
  const prInsightsLabelerWorkflow = readText(".github/workflows/pr-insights-labeler.yml");
  const releaseConfig = readText(".github/release.yml");
  const labelerConfig = readText(".github/labeler.yml");
  const issueTemplateFileNames = readdirSync(".github/ISSUE_TEMPLATE").filter(
    (fileName) => fileName.endsWith(".yml") && fileName !== "config.yml",
  );
  const miseToml = readMiseTaskCorpus();
  const nativeMenuSource = readText("src-tauri/src/menu.rs");
  const appActionsSource = readText("src/lib/app-actions.ts");
  const appIconThemeSource = readText("src/hooks/use-app-icon-theme.ts");
  const platformSource = readText("src-tauri/src/platform/mod.rs");
  const keyboardShortcutsSource = readText("src/lib/keyboard/keyboard-shortcuts.ts");
  const preferenceValuesSource = readText("src/schemas/preference-values.ts");
  const preferencesStoreSource = readText("src/stores/preferences-store.ts");
  const providerSource = readRustModuleSource("src-tauri/src/domain/provider.rs");
  const sqliteAccountSource = readText("src-tauri/src/infra/db/sqlite_account.rs");
  const platformConstantsSource = readText("src/constants/platform.ts");
  const providerHttpDefaultsSource = readRustModuleSource("src-tauri/src/infra/provider/http_defaults.rs");
  const greaderProviderSource = readGReaderProviderModuleSource();
  const addAccountFormSource = readText("src/lib/account/add-account-form.ts");
  const addAccountServicesSource = readText("src/components/settings/add-account/services.ts");

  it("parses TOML string values with quoted and multiline forms used by release contracts", () => {
    const toml = [
      'name = "ultra-\\"rss\\"-reader"',
      "description = '''",
      "A Tauri-based RSS reader",
      "with release provenance",
      "'''",
      'version = """1.2.3',
      'build"""',
    ].join("\n");

    expect(extractTomlString(toml, "name")).toBe('ultra-"rss"-reader');
    expect(extractTomlString(toml, "description")).toBe("A Tauri-based RSS reader\nwith release provenance\n");
    expect(extractTomlString(toml, "version")).toBe("1.2.3\nbuild");
  });

  it("keeps release tag, package, Tauri, and Cargo versions in one parity contract", () => {
    expect(packageJson.version).toBe(tauriConfig.version);
    expect(packageJson.version).toBe(extractTomlString(cargoToml, "version"));
    expect([...cargoLock.matchAll(/\[\[package\]\]\nname = "ultra-rss-reader"\nversion = "([^"]+)"/g)]).toHaveLength(1);
    expect(cargoLock).toContain(`name = "ultra-rss-reader"\nversion = "${packageJson.version}"`);
    expect(releaseWorkflow).not.toContain("node <<'NODE'");
    expect(releaseWorkflow).toContain("Validate release configuration");
    expect(releaseWorkflow).toContain("node ./scripts/release/validate-release-config.ts");
    expect(
      validateReleaseConfigSources({ releaseTag: `v${packageJson.version}`, sources: releaseConfigSources }),
    ).toEqual([]);
    expect(releaseConfigCli).toContain('from "./lib/config-validation.ts"');
    expect(codexReleaseChecks).toContain("src-tauri/Cargo.lock");
    expect(codexReleaseChecks).toContain("msix/Package.appxmanifest");
  });

  it("limits Store submissions to published releases whose tags match the checked-out commit", () => {
    const storeSubmissionScript = readText("scripts/release/submit-store.ps1");

    expect(storeMsixWorkflow).toContain("release:");
    expect(storeMsixWorkflow).toContain("types: [published]");
    expect(storeMsixWorkflow).toContain("workflow_run:");
    expect(storeMsixWorkflow).toContain("workflows: [Release]");
    expect(storeMsixWorkflow).toContain("github.event.workflow_run.head_sha");
    expect(storeMsixWorkflow).toContain("github.event.workflow_run.conclusion == 'success'");
    expect(storeMsixWorkflow).toContain("github.event.workflow_run.event == 'push'");
    expect(storeMsixWorkflow).toContain("github.event.release.tag_name");
    expect(storeMsixWorkflow).toContain("releases/tags/$RELEASE_TAG");
    expect(storeMsixWorkflow).toContain(".draft");
    expect(storeMsixWorkflow).toContain(".prerelease");
    expect(storeMsixWorkflow).toContain("git/ref/tags/$RELEASE_TAG");
    expect(storeMsixWorkflow).toContain('[[ "$tag_sha" == "$head_sha" ]]');
    expect(storeMsixWorkflow).toContain("default: false\n        type: boolean");
    expect(storeMsixWorkflow).toContain("environment: microsoft-store");
    expect(storeMsixWorkflow).toContain("contents: read");
    expect(storeMsixWorkflow).toContain(`group: microsoft-store-\${{ github.repository }}`);
    expect(storeMsixWorkflow).toContain("cancel-in-progress: false");
    expect(storeMsixWorkflow).toContain('[[ "$release_http_status" == "404" ]]');

    for (const secretName of ["MSSTORE_TENANT_ID", "MSSTORE_CLIENT_ID", "MSSTORE_CLIENT_SECRET"]) {
      expect(storeMsixWorkflow).toContain([secretName, ": $", "{{ secrets.", secretName, " }}"].join(""));
    }
    expect(storeMsixWorkflow).toContain('echo "should_submit=$submit_requested"');
    expect(storeMsixWorkflow).toContain("node ./scripts/release/validate-release-config.ts");
    expect(storeMsixWorkflow).toContain('GetEntry("AppxManifest.xml")');
    expect(storeMsixWorkflow).toContain("$identity.Version -ne $expectedVersion");
    expect(storeMsixWorkflow).toContain(`MSSTORE_PRICE_ID: \${{ vars.MSSTORE_PRICE_ID }}`);
    expect(storeSubmissionScript).toContain("[string]$PriceId = $env:MSSTORE_PRICE_ID");
    expect(storeSubmissionScript).toMatch(/if \(\$PriceId -cnotmatch '\\ATier\[0-9\]\+\\z'\) \{\s+throw /);
    expect(storeSubmissionScript.indexOf("if ($PriceId -cnotmatch")).toBeLessThan(
      storeSubmissionScript.indexOf("$missingCredentials = @("),
    );
    expect(storeSubmissionScript.indexOf("if ($PriceId -cnotmatch")).toBeLessThan(
      storeSubmissionScript.indexOf("Invoke-WebRequest"),
    );
    expect(storeSubmissionScript).toMatch(
      /elseif \(\$Method -eq 'POST'\) \{\s+(?:#[^\n]*\n\s+)?\$request\.ContentType = 'application\/json'\s+\$request\.TransferEncoding = 'chunked'\s+\$request\.Body = ''/,
    );
    expect(storeMsixWorkflow.indexOf("name: Submit and verify Store package")).toBeGreaterThan(
      storeMsixWorkflow.indexOf("uses: actions/upload-artifact@"),
    );
    expect(storeMsixWorkflow).toContain("auto_commit:");
    expect(storeMsixWorkflow).toContain("default: true\n        type: boolean");

    const actionRefs = extractWorkflowUses(storeMsixWorkflow).filter((ref) => !ref.startsWith("$/"));
    const lockEntries = extractWorkflowLockEntries(readText(".github/workflows/actions.lock"), "store-msix.yml");
    for (const actionRef of actionRefs) {
      expect(lockEntries).toContain(actionRef.toLowerCase());
    }
  });

  it("checks release source and version parity before artifact creation", () => {
    expect(releaseWorkflow).toContain("Validate release source");
    expect(releaseWorkflow).toContain(["ref: $", "{{ github.ref }}"].join(""));
    expect(releaseWorkflow).not.toContain("format('refs/tags/{0}', inputs.release_tag)");
    expect(releaseWorkflow).toContain("node ./scripts/release/validate-source.ts");
    expect(releaseSourceCli).toContain('from "./workflows/validate-source.ts"');
    expect(releaseSourceCli).toContain("runReleaseSourceValidationWorkflow(process.env)");
    expect(releaseSourceWorkflow).toContain('from "../lib/release-source-policy.ts"');
    expect(releaseWorkflow.indexOf("Validate release source")).toBeLessThan(
      releaseWorkflow.indexOf("pnpm install --frozen-lockfile"),
    );
    expect(releaseWorkflow.indexOf("Validate release configuration")).toBeLessThan(
      releaseWorkflow.indexOf("tauri-apps/tauri-action"),
    );
    expect(releaseWorkflow.indexOf("Run release quality preflight")).toBeLessThan(
      releaseWorkflow.indexOf("tauri-apps/tauri-action"),
    );
    expect(releaseWorkflow.indexOf("Validate release build contamination contract")).toBeLessThan(
      releaseWorkflow.indexOf("tauri-apps/tauri-action"),
    );
  });

  it("keeps a local release preflight available before pushing release tags", () => {
    const localPreflightTask = extractTaskBlock(miseToml, "release:preflight:local");
    const releaseSkill = readText(".codex/skills/release/references/phase-3-publish.md");
    const releaseRule = readText(".claude/rules/release-workflow.md");

    expect(localPreflightTask).toContain("RELEASE_TAG:?set RELEASE_TAG=vX.Y.Z");
    expect(localPreflightTask).toContain("mise exec -- node ./scripts/release/validate-release-config.ts");
    expect(localPreflightTask).toContain("mise exec -- pnpm run check:release-contamination");
    expect(localPreflightTask).toContain("mise exec -- mise run format:check");
    expect(localPreflightTask).toContain("mise exec -- mise run lint:types");
    expect(localPreflightTask).toContain("mise exec -- mise run test:unit:ci");
    expect(releaseSkill).toContain("RELEASE_TAG=v{new_version} mise run release:preflight:local");
    expect(releaseRule).toContain("RELEASE_TAG=vX.Y.Z mise run release:preflight:local");
  });

  it("keeps release draft and prerelease flags derived from the semver tag policy", () => {
    const releasePolicyStep = extractReleaseStepBlock(releaseWorkflow, "Resolve release semver policy");
    const tauriActionBlock = extractTauriActionBlock(releaseWorkflow);

    expect(releasePolicyStep).toContain('release_version="$' + '{RELEASE_TAG#v}"');
    expect(releasePolicyStep).toContain('if [[ "$release_version" == *-* ]]; then');
    expect(releasePolicyStep).toContain('echo "prerelease=$prerelease" >> "$GITHUB_OUTPUT"');
    expect(releasePolicyStep).toContain('echo "draft=true" >> "$GITHUB_OUTPUT"');
    expect(tauriActionBlock).toContain("releaseDraft: $" + "{{ steps.release-policy.outputs.draft }}");
    expect(tauriActionBlock).toContain("prerelease: $" + "{{ steps.release-policy.outputs.prerelease }}");
    expect(tauriActionBlock).not.toContain("prerelease: false");
    expect(releaseWorkflow.indexOf("Resolve release semver policy")).toBeLessThan(
      releaseWorkflow.indexOf("tauri-apps/tauri-action"),
    );
  });

  it("keeps release jobs on the shared pnpm setup before frozen installs", () => {
    const setupAction = readText(".github/actions/setup-pnpm/action.yml");
    const jobSections = [
      ...releaseWorkflow.matchAll(/^ {2}[A-Za-z0-9_-]+:\n([\s\S]*?)(?=^ {2}[A-Za-z0-9_-]+:\n|(?![\s\S]))/gm),
    ].map((match) => match[1] ?? "");

    for (const section of jobSections.filter((job) => job.includes("pnpm install --frozen-lockfile"))) {
      const miseIndex = section.indexOf("uses: jdx/mise-action@");
      const setupIndex = section.indexOf("uses: $/.github/actions/setup-pnpm");
      const installIndex = section.indexOf("pnpm install --frozen-lockfile");
      expect(miseIndex).toBeGreaterThanOrEqual(0);
      expect(miseIndex).toBeLessThan(setupIndex);
      expect(setupIndex).toBeLessThan(installIndex);
    }
    const sourceValidationIndex = releaseWorkflow.indexOf("run: node ./scripts/release/validate-source.ts");
    const firstSetupIndex = releaseWorkflow.indexOf("uses: $/.github/actions/setup-pnpm");
    expect(sourceValidationIndex).toBeLessThan(firstSetupIndex);
    expect(setupAction).toContain("uses: pnpm/setup@");
    expect(setupAction).toContain("cache: true");
    expect(setupAction).toContain("install: false");
  });

  it("keeps workflow pin checker leaving lockfile-covered action refs to actions.lock", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "ultra-rss-workflow-pins-"));
    try {
      writeFileSync(
        join(tempDir, "valid.yml"),
        [
          "name: valid",
          "on: workflow_dispatch",
          "jobs:",
          "  check:",
          "    runs-on: ubuntu-latest",
          "    steps:",
          "      - uses: 'actions/checkout@v6.1.0' # lockfile-covered tag",
          '      - uses: "jdx/mise-action@v4.3.0"',
          "      - uses: dtolnay/rust-toolchain@3c5f7ea28cd621ae0bf5283f0e981fb97b8a7af9 # allowlisted: no tag at this commit",
          "      - uses: $/.github/actions/local-tool",
          "      - uses: ./.github/actions/local-tool",
          "      - uses: owner/repo/.github/workflows/reusable.yml@1234567890abcdef1234567890abcdef12345678",
        ].join("\n"),
      );

      expect(runWorkflowPinChecker(tempDir)).toBe("");
    } finally {
      rmSync(tempDir, { force: true, recursive: true });
    }
  });

  it("keeps workflow pin checker rejecting floating quoted reusable workflow refs", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "ultra-rss-workflow-pins-"));
    try {
      writeFileSync(
        join(tempDir, "invalid.yml"),
        [
          "name: invalid",
          "on: workflow_dispatch",
          "jobs:",
          "  check:",
          "    runs-on: ubuntu-latest",
          "    steps:",
          "      - uses: 'owner/repo/.github/workflows/reusable.yml@v6' # floating ref",
        ].join("\n"),
      );

      expect(() => runWorkflowPinChecker(tempDir)).toThrow(
        /owner\/repo\/\.github\/workflows\/reusable\.yml@v6 must use a 40-character commit SHA/,
      );
    } finally {
      rmSync(tempDir, { force: true, recursive: true });
    }
  });

  it("keeps workflow pin checker rejecting action refs that are neither a version tag nor an allowlisted bare SHA", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "ultra-rss-workflow-pins-"));
    try {
      writeFileSync(
        join(tempDir, "invalid.yml"),
        [
          "name: invalid",
          "on: workflow_dispatch",
          "jobs:",
          "  check:",
          "    runs-on: ubuntu-latest",
          "    steps:",
          "      - uses: actions/checkout@main",
          "      - uses: actions/cache@1234567890abcdef1234567890abcdef12345678",
        ].join("\n"),
      );

      expect(() => runWorkflowPinChecker(tempDir)).toThrow(/actions\/checkout@main must use a version tag/);
      expect(() => runWorkflowPinChecker(tempDir)).toThrow(/actions\/cache@1234567890abcdef\w+ must use a version tag/);
    } finally {
      rmSync(tempDir, { force: true, recursive: true });
    }
  });

  it("limits release writes to contents and preflight run-history access to read", () => {
    const releasePermissions = extractYamlScalarBlockEntries(extractTopLevelYamlBlock(releaseWorkflow, "permissions"));

    expect(releasePermissions).toEqual({ contents: "write" });
    const jobPermissions = [...releaseWorkflow.matchAll(/^ {4}permissions:\n((?: {6}[^\n]+\n)+)/gm)];
    expect(jobPermissions.map((match) => match[1])).toEqual([
      "      contents: write\n      actions: read\n",
      "      contents: read\n",
    ]);
    expect(releaseWorkflow).toContain("  preflight:\n    permissions:\n      contents: write\n      actions: read");
  });

  it("checks the build slot under the tag lock and revalidates every build attempt", () => {
    expect(releaseWorkflow).toContain("run: node ./scripts/release/validate-source.ts");
    expect(releaseWorkflow).toContain("node ./scripts/release/guard-release-build.ts");
    expect(releaseWorkflow).toContain(`validated_run_attempt: \${{ steps.build-slot.outputs.validated_run_attempt }}`);
    const releaseJob = releaseWorkflow.slice(releaseWorkflow.indexOf("\n  release:"));
    expect(releaseJob).toContain('if [[ "$VALIDATED_RUN_ATTEMPT" != "$GITHUB_RUN_ATTEMPT" ]]');
    expect(releaseJob.indexOf("Require preflight for this run attempt")).toBeLessThan(
      releaseJob.indexOf("actions/checkout@"),
    );
  });

  it("keeps release workflow action, token, and cache surfaces pinned to the release asset scope", () => {
    const releaseUsesValues = extractWorkflowUses(releaseWorkflow);

    const releaseLockEntries = extractWorkflowLockEntries(readText(".github/workflows/actions.lock"), "release.yml");
    for (const usesValue of releaseUsesValues) {
      if (usesValue.startsWith("$/")) continue;
      expect(releaseLockEntries).toContain(usesValue.toLowerCase());
    }
    expect(releaseWorkflow).not.toContain("actions/upload-artifact");
    assertReleaseTokenUseScope(releaseWorkflow);
    expect(extractTauriActionBlock(releaseWorkflow)).toContain("GITHUB_TOKEN: $" + "{{ secrets.GITHUB_TOKEN }}");
    expect(extractReleaseStepBlock(releaseWorkflow, "Validate release signing preflight")).toContain(
      "TAURI_SIGNING_PRIVATE_KEY_SET: $" + "{{ secrets.TAURI_SIGNING_PRIVATE_KEY != '' }}",
    );
    expect(extractReleaseStepBlock(releaseWorkflow, "Validate release signing preflight")).toContain(
      "TAURI_SIGNING_PRIVATE_KEY_PASSWORD_SET: $" + "{{ secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD != '' }}",
    );
    expect(extractTauriActionBlock(releaseWorkflow)).toContain(
      "if: steps.signing-preflight.outputs.should_build == 'true'",
    );
    expect(extractReleaseStepBlock(releaseWorkflow, "Upload updater asset checksums")).toContain(
      "GH_TOKEN: $" + "{{ secrets.GITHUB_TOKEN }}",
    );
    expect(extractReleaseStepBlock(releaseWorkflow, "Upload release provenance assets")).toContain(
      "GH_TOKEN: $" + "{{ secrets.GITHUB_TOKEN }}",
    );
    expect(extractReleaseStepBlock(releaseWorkflow, "Validate existing draft release assets")).toContain(
      "GH_TOKEN: $" + "{{ secrets.GITHUB_TOKEN }}",
    );
  });

  it("rejects release token use outside the permitted steps and env bindings", () => {
    const unauthorized = releaseWorkflow.replace(
      "      - name: Generate Linux release provenance\n",
      "      - name: Generate Linux release provenance\n        unexpected: $" + "{{ secrets.GITHUB_TOKEN }}\n",
    );
    expect(() => assertReleaseTokenUseScope(unauthorized)).toThrow("GitHub token use is not allowed");
    const duplicate = releaseWorkflow.replace(
      "      - name: Upload Linux release provenance\n",
      "      - name: Upload Linux release provenance\n        unexpected: $" + "{{ secrets.GITHUB_TOKEN }}\n",
    );
    expect(() => assertReleaseTokenUseScope(duplicate)).toThrow("GitHub token binding does not match");
    const wrongBinding = releaseWorkflow.replace(
      "GITHUB_TOKEN: $" + "{{ secrets.GITHUB_TOKEN }}",
      "GH_TOKEN: $" + "{{ secrets.GITHUB_TOKEN }}",
    );
    expect(() => assertReleaseTokenUseScope(wrongBinding)).toThrow("GitHub token binding does not match");
  });

  it("rejects release token bindings relocated to with, run literals or nested env mappings", () => {
    const expression = "$" + "{{ secrets.GITHUB_TOKEN }}";
    const tauriStep = extractTauriActionBlock(releaseWorkflow);
    const tauriWithoutToken = tauriStep.replace(`          GITHUB_TOKEN: ${expression}\n`, "");
    const linuxStep = extractReleaseStepBlock(releaseWorkflow, "Upload Linux release provenance");
    const linuxWithoutToken = linuxStep.replace(`          GH_TOKEN: ${expression}\n`, "");
    const relocatedSteps = [
      {
        original: tauriStep,
        relocated: tauriWithoutToken.replace(
          "        with:\n",
          `        with:\n          GITHUB_TOKEN: ${expression}\n`,
        ),
      },
      {
        original: linuxStep,
        relocated: linuxWithoutToken.replace(
          "        run: node ./scripts/release/linux-provenance.ts upload",
          `        run: |\n          GH_TOKEN: ${expression}\n          node ./scripts/release/linux-provenance.ts upload`,
        ),
      },
      {
        original: linuxStep,
        relocated: linuxWithoutToken.replace(
          "        env:\n",
          `        env:\n          forwarded:\n            GH_TOKEN: ${expression}\n`,
        ),
      },
    ];
    for (const { original, relocated } of relocatedSteps) {
      expect(relocated).not.toBe(original);
      expect(() => assertReleaseTokenUseScope(releaseWorkflow.replace(original, relocated))).toThrow(
        "GitHub token binding does not match",
      );
    }
  });

  it("keeps CI apt mirror failures bounded with a fallback mirror and a .deb cache", () => {
    const dependencyScript = readText("scripts/ci/install-tauri-deps.sh");
    const linuxDepsAction = readText(".github/actions/setup-tauri-linux-deps/action.yml");
    expect(ciWorkflow).not.toContain("bash scripts/ci/install-tauri-deps.sh");
    expect(linuxDepsAction).toContain("run: bash scripts/ci/install-tauri-deps.sh plan");
    expect(linuxDepsAction).toContain("run: bash scripts/ci/install-tauri-deps.sh install");
    expect(linuxDepsAction).toContain("uses: actions/cache/restore@");
    expect(linuxDepsAction).toContain("uses: actions/cache/save@");
    expect(linuxDepsAction).toContain(
      "if: steps.restore.outputs.cache-hit != 'true' && github.ref == 'refs/heads/main'",
    );
    expect(dependencyScript).toContain('-o "Dir::Cache::Archives=$TAURI_APT_ARCHIVE_DIR"');
    expect(dependencyScript).toContain('"$apt_etc/apt-mirrors.txt"');
  });

  it("cancels superseded CI runs only for pull requests", () => {
    const githubExpressionOpen = "${{";
    // A shared group would still replace a pending main run with the next one.
    expect(ciWorkflow).toContain(
      `group: ${githubExpressionOpen} github.workflow }}-${githubExpressionOpen} github.event_name == 'pull_request' && github.ref || github.run_id }}`,
    );
    expect(ciWorkflow).toContain(`cancel-in-progress: ${githubExpressionOpen} github.event_name == 'pull_request' }}`);
  });

  it("keeps jactionlint shellcheck disabled only with a paired shell gate", () => {
    expect(miseToml).toContain('shellcheck = "latest"');
    expect(miseToml).toContain('"lint:actions-shell"');
    expect(extractTaskBlock(miseToml, "lint:actions")).toContain("jactionlint --shellcheck=");
    expect(extractTaskBlock(miseToml, "lint:actions-shell")).toContain('run = "jactionlint"');
  });

  it("documents the intentionally narrow Windows Rust test scope", () => {
    const githubExpressionOpen = "${{";
    const rustTestTask = extractTaskBlock(miseToml, "test:rust");

    expect(rustTestTask).toContain("Windows CI is scoped to integration_test");
    expect(rustTestTask).toContain("Linux runs the full Rust suite");
    expect(rustTestTask).toContain('run = "cargo nextest run --manifest-path src-tauri/Cargo.toml"');
    expect(rustTestTask).toContain(
      'run_windows = "cargo nextest run --manifest-path src-tauri/Cargo.toml --target-dir src-tauri/target/test-rust --test integration_test"',
    );
    const ciTestTask = extractTaskBlock(miseToml, "test:ci");
    expect(ciTestTask).toContain("mise run test:unit:ci\nmise run test:rust");
    expect(ciTestTask).toContain('run_windows = "mise run test:unit:ci && mise run test:rust"');
    const jobBlock = (id: string) =>
      ciWorkflow.match(new RegExp(`^  ${id}:\\n([\\s\\S]*?)(?=^  [\\w-]+:|(?![\\s\\S]))`, "m"))?.[1] ?? "";
    const nodeJob = jobBlock("test-node");
    const rustJob = jobBlock("test-rust");
    const jsdomJob = jobBlock("test-jsdom");
    const gateJob = ciWorkflow.slice(ciWorkflow.indexOf("\n  quality-gate:"));
    for (const block of [nodeJob, rustJob, jsdomJob]) expect(block).toContain("needs: change-plan");
    expect(nodeJob).toContain("mise run test:unit:ci:node");
    expect(nodeJob).not.toContain("mise run test:rust");
    expect(nodeJob).not.toContain("dtolnay/rust-toolchain");
    expect(rustJob).toContain("mise run test:rust");
    expect(rustJob).toContain("dtolnay/rust-toolchain");
    expect(rustJob).toContain("Swatinem/rust-cache");
    expect(rustJob).toContain(`save-if: ${githubExpressionOpen} github.ref == 'refs/heads/main' }}`);
    expect(rustJob).toContain("Install Tauri system dependencies");
    for (const block of [nodeJob, jsdomJob]) {
      expect(block).not.toContain("Swatinem/rust-cache");
      expect(block).not.toContain("Install Tauri system dependencies");
    }
    expect(jsdomJob).toContain("fail-fast: false");
    expect(jsdomJob).toContain(`mise run test:unit:ci:dom:shard${githubExpressionOpen} matrix.shard }}`);
    const loggedScript = readText("scripts/ci/run-logged.sh");
    expect(loggedScript).toContain("set -euo pipefail");
    expect(loggedScript).toContain('"$@" 2>&1 | tee "$log_path"');
    expect(nodeJob).toContain("bash scripts/ci/run-logged.sh tmp/ci-artifacts/frontend/test.log");
    expect(rustJob).toContain("bash scripts/ci/run-logged.sh tmp/ci-artifacts/rust/test.log");
    expect(jsdomJob).toContain("bash scripts/ci/run-logged.sh tmp/ci-artifacts/frontend/test.log");
    const contaminationCommand = "node ./scripts/check-release-build-contamination.ts";
    const contaminationStep = extractWorkflowStepBlocks(rustJob).find((step) => step.includes(contaminationCommand));
    expect(contaminationStep).not.toContain("continue-on-error");
    expect(contaminationStep).not.toContain("if:");
    expect(rustJob.indexOf(contaminationCommand)).toBeGreaterThan(rustJob.indexOf("mise run test:rust"));
    expect(jsdomJob).toContain(
      `name: frontend-${githubExpressionOpen} matrix.os }}-jsdom-shard${githubExpressionOpen} matrix.shard }}-test-log`,
    );
    expect(extractTaskBlock(miseToml, "test:unit:ci:dom:shard1")).toContain("--project jsdom --shard=1/2");
    expect(extractTaskBlock(miseToml, "test:unit:ci:dom:shard2")).toContain("--project jsdom --shard=2/2");
    expect(gateJob).toContain("node scripts/ci/quality-gate.ts");
    expect(ciWorkflow).not.toContain("mise run test:ci");
    expect(ciWorkflow).not.toMatch(/\brun:\s+cargo test\b/);
    const credentialPolicyStep = extractWorkflowStepBlocks(ciWorkflow).find((step) =>
      step.includes("mise run test:keychain-session"),
    );
    expect(credentialPolicyStep).toContain("needs.change-plan.outputs.credentials == 'true'");
    expect(credentialPolicyStep).not.toContain("runner.os == 'macOS'");
    expect(ciWorkflow).not.toMatch(/mise run test:unit:ci:dom\b(?!:shard)/);
  });

  it("keeps Rust cfg(test) production-only release gaps inventoried", () => {
    for (const productionOnlySurface of [
      "Tauri runtime startup",
      "Panic and logging",
      "Native updater install",
      "macOS titlebar/focus",
    ]) {
      expect(releaseManualVerification).toContain(productionOnlySurface);
    }
    expect(tauriLib).toContain("#[cfg(not(test))]");
    expect(tauriLib).toContain("fn run()");
  });

  it("keeps release artifact display metadata source-of-truth explicit", () => {
    expect(packageJson.name).toBe("ultra-rss-reader");
    expect(packageJson.private).toBe(true);
    expect(extractTomlString(cargoToml, "name")).toBe(packageJson.name);
    expect(extractTomlString(cargoToml, "description")).toBe("A Tauri-based RSS reader");
    expect(tauriConfig.productName).toBe("Ultra RSS Reader");
    expect(tauriConfig.identifier).toBe(PROD_TAURI_IDENTIFIER);
    expect(tauriReleaseConfig.identifier).toBe(tauriConfig.identifier);
    expect(tauriConfig.bundle?.createUpdaterArtifacts).toBe(false);
    expect(tauriReleaseConfig.bundle?.createUpdaterArtifacts).toBe(true);
  });

  it("requires the release workflow to build with the release updater config", () => {
    const tauriActionBlock = extractTauriActionBlock(releaseWorkflow);

    expect(tauriActionBlock).toContain(`--config ${RELEASE_TAURI_CONFIG_PATH}`);
    expect(tauriActionBlock).not.toContain(`--config ${DEV_TAURI_CONFIG_PATH}`);
    expect(tauriActionBlock).not.toContain('--config \'{"identifier"');
    expect(releaseConfigCli).toContain(
      'releaseTauriConfig: readFileSync(join(root, "src-tauri/tauri.release.conf.json")',
    );
    expect(releaseConfigCli).toContain('devTauriConfig: readFileSync(join(root, "src-tauri/tauri.dev.conf.json")');
    expect(
      validateReleaseConfigSources({
        releaseTag: `v${packageJson.version}`,
        sources: {
          ...releaseConfigSources,
          releaseTauriConfig: JSON.stringify({
            ...tauriReleaseConfig,
            bundle: { ...tauriReleaseConfig.bundle, createUpdaterArtifacts: false },
          }),
        },
      }),
    ).toContain("src-tauri/tauri.release.conf.json must enable updater artifacts for release builds");
    expect(
      validateReleaseConfigSources({
        releaseTag: `v${packageJson.version}`,
        sources: {
          ...releaseConfigSources,
          releaseWorkflow: releaseWorkflow.replaceAll(RELEASE_TAURI_CONFIG_PATH, DEV_TAURI_CONFIG_PATH),
        },
      }),
    ).toContain("release workflow must pass src-tauri/tauri.release.conf.json to tauri-action");
    expect(releaseWorkflow.indexOf("Validate release configuration")).toBeLessThan(
      releaseWorkflow.indexOf("tauri-apps/tauri-action"),
    );
  });

  it("keeps Tauri CSP explicit across release and dev HMR boundaries", () => {
    const csp = tauriConfig.app?.security?.csp ?? "";
    const directives = parseCspDirectives(csp);

    expect(csp).toContain("img-src 'self' https: http:");
    expect(csp).not.toContain("upgrade-insecure-requests");
    expect(csp).not.toContain("default-src *");
    expect(csp).not.toContain("img-src *");
    for (const [directive, requiredSources] of Object.entries(REQUIRED_RELEASE_CSP_DIRECTIVES)) {
      expect(directives.get(directive)).toEqual(expect.arrayContaining([...requiredSources]));
    }
    for (const [directive, sources] of directives) {
      for (const forbiddenSource of RELEASE_CSP_FORBIDDEN_SOURCES) {
        expect(sources, `${directive} must not include ${forbiddenSource}`).not.toContain(forbiddenSource);
      }
    }
    expect(tauriReleaseConfig.app?.security?.csp).toBeUndefined();
    expect(tauriDevConfig.app?.security?.csp).toBeUndefined();
    expect(tauriDevConfig.build?.devUrl).toBe("http://127.0.0.1:1420");
  });

  it("keeps Windows manifest, build script, and capability configuration in the local release gate", () => {
    const buildScript = readText("src-tauri/build.rs");
    const windowsManifest = readText("src-tauri/windows-test-manifest.xml");
    const defaultCapabilitySource = readText("src-tauri/capabilities/default.json");

    expect(buildScript).toContain('join("windows-test-manifest.xml")');
    expect(buildScript).toContain("cargo:rerun-if-changed={}");
    expect(buildScript).toContain("cargo:rustc-link-arg=/MANIFEST:EMBED");
    expect(buildScript).toContain("cargo:rustc-link-arg=/MANIFESTINPUT:{}");
    expect(buildScript).toContain("cargo:rustc-link-arg=/WX");
    expect(buildScript).toContain("copy_webview2_loader()");
    expect(buildScript).toContain('expect("failed to copy WebView2Loader.dll for Windows release smoke")');
    expect(buildScript).toContain("Could not find WebView2Loader.dll to copy");
    expect(buildScript).toContain("Unsupported target arch for WebView2 loader copy");
    expect(buildScript).toContain("Failed to copy WebView2Loader.dll to");
    expect(buildScript).not.toContain("cargo:warning=Could not find WebView2Loader.dll to copy");
    expect(buildScript).not.toContain("cargo:warning=Failed to copy WebView2Loader.dll");
    expect(releaseWorkflow).toContain("Run release quality preflight");
    expect(releaseWorkflow).toContain("mise run format:check");
    expect(releaseWorkflow).toContain("mise run lint:types");
    expect(releaseWorkflow).toContain("mise run test:unit:ci");
    expect(releaseWorkflow).not.toContain("run: mise run ci");
    expect(buildScript).toContain("WindowsAttributes::new_without_app_manifest()");
    expect(windowsManifest).toContain('xmlns="urn:schemas-microsoft-com:asm.v1"');
    expect(windowsManifest).toContain('name="Microsoft.Windows.Common-Controls"');
    expect(windowsManifest).toContain('version="6.0.0.0"');
    expect(defaultCapabilitySource).toContain('"$schema": "../gen/schemas/desktop-schema.json"');
  });

  it("keeps bundle identifier, release updater artifacts, and updater endpoint in one release contract", () => {
    expect(tauriConfig.identifier).toBe(PROD_TAURI_IDENTIFIER);
    expect(tauriReleaseConfig.identifier).toBe(tauriConfig.identifier);
    expect(tauriConfig.bundle?.createUpdaterArtifacts).toBe(false);
    expect(tauriReleaseConfig.bundle?.createUpdaterArtifacts).toBe(true);
    expect(tauriConfig.plugins?.updater?.endpoints).toEqual([RELEASE_UPDATER_ENDPOINT]);
    expect(tauriConfig.plugins?.updater?.pubkey).toBeTruthy();
    expect(tauriConfig.plugins?.updater?.pubkey).not.toMatch(UPDATER_PUBKEY_PLACEHOLDER_PATTERN);
    expect(
      validateReleaseConfigSources({
        releaseTag: `v${packageJson.version}`,
        sources: {
          ...releaseConfigSources,
          tauriConfig: JSON.stringify({
            ...tauriConfig,
            plugins: { ...tauriConfig.plugins, updater: { ...tauriConfig.plugins?.updater, pubkey: "placeholder" } },
          }),
        },
      }),
    ).toContain("src-tauri/tauri.conf.json updater pubkey must be configured and must not be a placeholder");
  });

  it("documents the production app data namespace migration path before any bundle identifier change", () => {
    expect(tauriConfig.identifier).toBe(PROD_TAURI_IDENTIFIER);
    expect(tauriReleaseConfig.identifier).toBe(PROD_TAURI_IDENTIFIER);
    expect(tauriDevConfig.identifier).toBe(DEV_TAURI_IDENTIFIER);
  });

  it("keeps provider HTTP client hardening wired in the shared defaults", () => {
    expect(providerHttpDefaultsSource).toContain(".timeout(PROVIDER_HTTP_TIMEOUT)");
    expect(providerHttpDefaultsSource).toContain(".no_proxy()");
    expect(providerHttpDefaultsSource).toContain("HeaderValue::from_static(PROVIDER_CACHE_CONTROL)");
    expect(providerHttpDefaultsSource).toContain("HeaderValue::from_static(PROVIDER_PRAGMA)");
  });

  it("keeps production release log timezone policy synchronized with support docs", () => {
    const strategy = tauriLib.match(/RELEASE_LOG_TIMEZONE_STRATEGY: &str = "([^"]+)"/)?.[1];

    expect(strategy, "release log timezone strategy constant").toBeDefined();
    expect(tauriLib).toContain(`TimezoneStrategy::${strategy}`);
    for (const doc of [incidentRunbook, releaseManualVerification]) {
      expect(doc).toContain(`TimezoneStrategy::${strategy}`);
    }
  });

  it("keeps packaged window icon paths and runtime platform fallback in the release smoke contract", () => {
    expect(tauriDevConfig.bundle?.icon).toBeUndefined();
    expect(tauriReleaseConfig.bundle?.icon).toBeUndefined();

    for (const iconPath of PACKAGED_WINDOW_ICON_PATHS) {
      expect(iconPath, iconPath).toMatch(/^icons\//);
      expect(iconPath, iconPath).not.toMatch(/^\/|^\.\.|\\/);
      expect(existsSync(`src-tauri/${iconPath}`), iconPath).toBe(true);
    }

    expect(PACKAGED_WINDOW_ICON_PATHS.some((iconPath) => iconPath.endsWith(".icns"))).toBe(true);
    expect(PACKAGED_WINDOW_ICON_PATHS.some((iconPath) => iconPath.endsWith(".ico"))).toBe(true);
    expect(PACKAGED_WINDOW_ICON_PATHS.some((iconPath) => iconPath.endsWith(".png"))).toBe(true);
    expect(platformSource).toMatch(
      /PlatformKind::Macos => PlatformCapabilities \{[\s\S]*?supports_runtime_window_icon_replacement: false,/,
    );
    expect(platformSource).toMatch(
      /PlatformKind::Windows => PlatformCapabilities \{[\s\S]*?supports_runtime_window_icon_replacement: true,/,
    );
    expect(platformSource).toMatch(
      /PlatformKind::Linux \| PlatformKind::Unknown => PlatformCapabilities \{[\s\S]*?supports_runtime_window_icon_replacement: false,/,
    );
    expect(appIconThemeSource).toContain("shouldSkipRuntimeIconReplacement");
    expect(appIconThemeSource).toContain('logRuntimeDiagnostic("app-icon-theme"');
  });

  it("keeps generated Android and iOS app icon assets pinned to the release smoke contract", () => {
    const expectedIconPaths = [...MOBILE_ICON_ASSET_PATHS].sort();
    const generatedIconPaths = [
      ...readdirSync("src-tauri/icons/android", { recursive: true }).map((entry) => `android/${entry}`),
      ...readdirSync("src-tauri/icons/ios", { recursive: true }).map((entry) => `ios/${entry}`),
    ]
      .filter((entry): entry is string => typeof entry === "string")
      .filter((entry) => /\.(?:png|xml)$/.test(entry))
      .map((entry) => normalizeRepoPath(`icons/${entry}`))
      .sort();

    expect(generatedIconPaths).toEqual(expectedIconPaths);

    expect(readText("mise.toml")).toContain('run = "tauri icon assets/app-icon-tauri-source.png"');
    expect(readText("docs/README.md")).toContain(
      "`assets/app-icon-tauri-source.png` is the checked-in Tauri source image",
    );
  });

  it("keeps updater manifest platforms mapped back to release assets and checksums", () => {
    expect(tauriReleaseConfig.bundle?.createUpdaterArtifacts).toBe(true);
    expect(releaseWorkflow).toContain("Validate updater manifest asset contract");
    expect(releaseWorkflow).toContain("Generate updater asset checksums");
    expect(releaseWorkflow).toContain("Upload updater asset checksums");
    expect(releaseWorkflow).toContain("node ./scripts/release/artifacts.ts validate-updater-assets");
    expect(releaseWorkflow).toContain("node ./scripts/release/artifacts.ts generate-updater-checksums");
    expect(releaseWorkflow).toContain("node ./scripts/release/artifacts.ts upload-updater-checksums");
    expect(releaseArtifactsCli).toContain('from "./lib/artifact-contract.ts"');
    expect(releaseArtifactWorkflow).toContain('from "../lib/artifact-contract.ts"');
    expect(actualReleaseUpdaterAssetContract).toHaveLength(RELEASE_UPDATER_ASSET_CONTRACT.length);

    for (const contract of RELEASE_UPDATER_ASSET_CONTRACT) {
      expect(actualReleaseUpdaterAssetContract).toContainEqual({
        assetPattern: contract.assetPattern,
        artifactArch: contract.artifactArch,
        artifactPlatform: contract.artifactPlatform,
        checksumPattern: contract.checksumPattern,
        matrixArgs: contract.matrixArgs,
        matrixPlatform: contract.matrixPlatform,
        platformKey: contract.platformKey,
        signaturePattern: contract.signaturePattern,
      });
      expect(releaseWorkflow).toContain(`"platform":"${contract.matrixPlatform}"`);
      expect(releaseWorkflow).toContain(`"artifact_platform":"${contract.artifactPlatform}"`);
      expect(releaseWorkflow).toContain(`"artifact_arch":"${contract.artifactArch}"`);
      expect(releaseWorkflow).toContain(`"updater_platform":"${contract.platformKey}"`);
      expect(releaseWorkflow).toContain(`"updater_asset_pattern":"${contract.assetPattern}"`);
      expect(releaseWorkflow).toContain(`"updater_signature_pattern":"${contract.signaturePattern}"`);
      const matrixArgs = contract.matrixArgs === '""' ? '"args":""' : `"args":"${contract.matrixArgs}"`;
      expect(releaseWorkflow).toContain(matrixArgs);
      expect(contract.signaturePattern).toBe(`${contract.assetPattern}.sig`);
      expect(contract.checksumPattern).toBe(`${contract.assetPattern}.sha256`);
    }

    expect(releaseWorkflow).toContain("build_linux:");
    expect(releaseWorkflow).toContain("default: false");
    expect(releaseWorkflow).toContain('"platform":"ubuntu-24.04"');
    expect(releaseWorkflow).toContain('"updater_enabled":false');
    expect(releaseWorkflow).toContain("matrix.updater_enabled == true");

    const matrixDefinition = /matrix='([^']+)'/.exec(releaseWorkflow);
    if (!matrixDefinition) {
      throw new Error("release matrix definition is missing");
    }
    const releaseMatrix = JSON.parse(`${matrixDefinition[1].replaceAll('\\"', '"')}]}`);
    if (
      typeof releaseMatrix !== "object" ||
      releaseMatrix === null ||
      !("include" in releaseMatrix) ||
      !Array.isArray(releaseMatrix.include)
    ) {
      throw new Error("release matrix definition is not an include array");
    }
    for (const contract of RELEASE_UPDATER_ASSET_CONTRACT) {
      const matrixEntry = releaseMatrix.include.find(
        (entry: unknown): entry is Record<string, unknown> =>
          typeof entry === "object" &&
          entry !== null &&
          "platform" in entry &&
          entry.platform === contract.matrixPlatform,
      );
      expect(matrixEntry).toEqual(
        expect.objectContaining({
          artifact_arch: contract.artifactArch,
          artifact_platform: contract.artifactPlatform,
          cargo_target: contract.cargoTarget,
          updater_platform: contract.platformKey,
        }),
      );
    }

    const dependencyProvenanceStep = extractReleaseStepBlock(releaseWorkflow, "Generate release dependency provenance");
    expect(dependencyProvenanceStep).toContain("CARGO_LICENSE_TARGET: $" + "{{ matrix.cargo_target }}");

    expect(actualUnsupportedUpdaterPlatformKeys).toEqual(UNSUPPORTED_UPDATER_PLATFORM_KEYS);
    for (const unsupportedPlatformKey of actualUnsupportedUpdaterPlatformKeys) {
      expect(actualReleaseUpdaterAssetContract.map((contract) => contract.platformKey)).not.toContain(
        unsupportedPlatformKey,
      );
    }
  });

  it("keeps release artifact provenance evidence tied to tag, workflow, checksum, and SBOM records", () => {
    expect(releaseWorkflow).toContain("Validate release source");
    expect(releaseWorkflow).toContain("node ./scripts/release/validate-source.ts");
    expect(releaseWorkflow).toContain("Generate updater asset checksums");
    expect(releaseWorkflow).toContain("Upload updater asset checksums");
    expect(releaseWorkflow).toContain("Generate release dependency provenance");
    expect(releaseWorkflow).toContain("Generate release provenance record");
    expect(releaseWorkflow).toContain("Upload release provenance assets");
    expect(releaseWorkflow).toContain("mise run report:licenses");
    expect(dependencyLicenseReportScript).toContain("CARGO_LICENSE_TARGET");
    expect(dependencyLicenseReportScript).toContain('"--filter-platform"');
    expect(releaseArtifactsCli).toContain('from "./workflows/artifacts.ts"');
    expect(releaseArtifactsCli).toContain("runArtifactWorkflow(command, process.env, productionArtifactWorkflowIO)");
    expect(releaseWorkflow).toContain("releaseDraft: $" + "{{ steps.release-policy.outputs.draft }}");
    expect(releaseWorkflow.indexOf("Generate updater asset checksums")).toBeLessThan(
      releaseWorkflow.indexOf("Generate release provenance record"),
    );
    expect(releaseWorkflow.indexOf("Generate release provenance record")).toBeLessThan(
      releaseWorkflow.indexOf("Upload release provenance assets"),
    );
  });

  it("stops release artifact publication when signing secrets are missing and keeps dry-run preflight explicit", () => {
    const signingPreflightStep = extractReleaseStepBlock(releaseWorkflow, "Validate release signing preflight");

    expect(releaseWorkflow).toContain("dry_run:");
    expect(signingPreflightStep).toContain(
      "DRY_RUN: $" + "{{ github.event_name == 'workflow_dispatch' && inputs.dry_run || false }}",
    );
    expect(signingPreflightStep).toContain('echo "should_publish=false" >> "$GITHUB_OUTPUT"');
    expect(signingPreflightStep).toContain('echo "should_build=false" >> "$GITHUB_OUTPUT"');
    expect(signingPreflightStep).toContain("release dry run validated source, versions, cache, and signing preflight");
    expect(signingPreflightStep).toContain("release recovery will validate existing draft assets without rebuilding");
    expect(signingPreflightStep).toContain('missing+=("TAURI_SIGNING_PRIVATE_KEY")');
    expect(signingPreflightStep).toContain('missing+=("TAURI_SIGNING_PRIVATE_KEY_PASSWORD")');
    expect(signingPreflightStep).toContain(
      "release signing secrets are required before artifact build or draft release upload",
    );
    expect(signingPreflightStep).toContain("rerun workflow_dispatch with dry_run=true");
    expect(signingPreflightStep).toContain('echo "should_publish=true" >> "$GITHUB_OUTPUT"');
    expect(signingPreflightStep).toContain('echo "should_build=true" >> "$GITHUB_OUTPUT"');
    const qualityJobBlock = releaseWorkflow.slice(
      releaseWorkflow.indexOf("\n  quality:"),
      releaseWorkflow.indexOf("\n  release:"),
    );
    expect(qualityJobBlock).toContain("needs: preflight");
    expect(qualityJobBlock).toContain("if: needs.preflight.outputs.should_build == 'true'");
    expect(qualityJobBlock).toContain("Run release quality preflight");
    for (const stepName of [
      "Validate release build contamination contract",
      "Resolve release semver policy",
      "Validate updater manifest asset contract",
      "Generate updater asset checksums",
      "Generate release dependency provenance",
      "Generate release provenance record",
      "Upload updater asset checksums",
      "Upload release provenance assets",
    ]) {
      expect(extractReleaseStepBlock(releaseWorkflow, stepName)).toContain(
        "if: steps.signing-preflight.outputs.should_build == 'true'",
      );
    }
    expect(extractReleaseStepBlock(releaseWorkflow, "Validate existing draft release assets")).toContain(
      "if: steps.signing-preflight.outputs.should_publish == 'true' && steps.signing-preflight.outputs.should_build == 'false'",
    );
    expect(releaseWorkflow.indexOf("Validate release signing preflight")).toBeLessThan(
      releaseWorkflow.indexOf("Run release quality preflight"),
    );
    expect(releaseWorkflow.indexOf("Validate release signing preflight")).toBeLessThan(
      releaseWorkflow.indexOf("tauri-apps/tauri-action"),
    );
  });

  it("gates release artifact publication on the release quality preflight", () => {
    const releaseJobBlock = releaseWorkflow.slice(releaseWorkflow.indexOf("\n  release:"));

    expect(releaseJobBlock).toContain("needs: [preflight, quality]");
    expect(releaseJobBlock).toContain("!cancelled()");
    expect(releaseJobBlock).toContain("needs.quality.result == 'success' || needs.quality.result == 'skipped'");
  });

  it("keeps Release Drafter config separate from release workflow publishing responsibilities", () => {
    expect(releaseConfig).toContain("Release Drafter only owns PR-label changelog grouping");
    expect(releaseConfig).toContain(".github/workflows/release.yml owns tag validation");
    expect(releaseConfig).not.toContain("artifacts:");
    expect(releaseConfig).not.toContain("tag-template:");
    expect(releaseConfig).not.toContain("version-template:");
    expect(releaseWorkflow).toContain("generateReleaseNotes: false");
    expect(releaseWorkflow).toContain("releaseDraft: $" + "{{ steps.release-policy.outputs.draft }}");
    expect(readReleaseSkillCorpus()).toContain(
      ".github/release.yml` only owns Release Drafter PR-label changelog grouping",
    );
  });

  it("keeps release note publication owned by the release skill with prerelease and build metadata policy", () => {
    const releaseSkill = readReleaseSkillCorpus();
    const releasePolicyStep = extractReleaseStepBlock(releaseWorkflow, "Resolve release semver policy");

    expect(releaseWorkflow).toContain("generateReleaseNotes: false");
    expect(releasePolicyStep).toContain('if [[ "$release_version" == *-* ]]; then');
    expect(releaseSkill).toContain("Write release notes and `CHANGELOG.md` entries in concise Japanese");
    expect(releaseSkill).toContain("grounded in the actual commit history");
    expect(releaseSkill).toContain("Stable tags use `prerelease=false`");
    expect(releaseSkill).toContain("semver prerelease tags such as `v1.2.3-alpha.1` use `prerelease=true`");
    expect(releaseSkill).toContain(
      "build metadata alone such as `v1.2.3+build.1` does not make the Release a prerelease",
    );
    expect(releaseSkill).toContain("Treat the CLI as the source of truth for release note body text");
    expect(releaseSkill).toContain("After create/edit, verify with:");
    expect(releaseSkill).toContain("gh release view v{new_version} --json tagName,isDraft,url,body");
    expect(releaseSkill).toContain("Do not generate release notes after the release commit has been created");
  });

  it("keeps flaky test quarantine discoverable through TODO or issue links and skip annotations", () => {
    const flakyPolicy = readText("docs/flaky-test-quarantine-policy.md");
    const sourceFiles = listRepoFiles()
      .filter((path) => /\.(?:ts|tsx|rs)$/.test(path))
      .filter((path) => path.startsWith("tests/") || path.startsWith("src/") || path.startsWith("scripts/"));
    const skippedTestAnnotations = sourceFiles.flatMap((path) => {
      const source = readText(path);
      return [...source.matchAll(/(?:it|test|describe)\.skip\s*\(/g)].map((match) => {
        const prefix = source.slice(Math.max(0, match.index - 240), match.index);
        return { path, prefix };
      });
    });

    expect(flakyPolicy).toContain("todo.txt");
    expect(flakyPolicy).toContain("GitHub issue");
    expect(flakyPolicy).toContain("owner=<owner>");
    expect(flakyPolicy).toContain("expires=<YYYY-MM-DD>");
    expect(flakyPolicy).toContain("evidence=<command/result>");
    expect(flakyPolicy).toContain("unskip=<focused command>");
    expect(flakyPolicy).toContain("flaky-quarantine:");
    for (const annotation of skippedTestAnnotations) {
      expect(annotation.prefix, annotation.path).toContain("flaky-quarantine:");
      expect(annotation.prefix, annotation.path).toMatch(/TODO=(?:TODO\.md|https:\/\/github\.com\/)/);
      expect(annotation.prefix, annotation.path).toMatch(/owner=[^;\n]+/);
      expect(annotation.prefix, annotation.path).toMatch(/expires=\d{4}-\d{2}-\d{2}/);
      expect(annotation.prefix, annotation.path).toMatch(/evidence=[^;\n]+/);
      expect(annotation.prefix, annotation.path).toMatch(/unskip=[^;\n]+/);
    }
  });

  it("keeps release builds from using dev Tauri config or dev credentials", () => {
    const tauriActionBlock = extractTauriActionBlock(releaseWorkflow);
    expect(checkReleaseBuildSources()).toEqual([]);
    expect(tauriDevConfig.identifier).not.toBe(tauriReleaseConfig.identifier);
    expect(tauriDevConfig.productName).not.toBe(tauriConfig.productName);
    expect(tauriDevConfig.build?.devUrl).toBe("http://127.0.0.1:1420");
    const devConfigErrors = validateReleaseConfigSources({
      releaseTag: `v${packageJson.version}`,
      sources: {
        ...releaseConfigSources,
        releaseTauriConfig: JSON.stringify({
          ...tauriReleaseConfig,
          identifier: tauriDevConfig.identifier,
          productName: tauriDevConfig.productName,
        }),
      },
    });
    expect(devConfigErrors).toContain("src-tauri/tauri.release.conf.json must not use the dev Tauri identifier");
    expect(devConfigErrors).toContain("src-tauri/tauri.release.conf.json must not use the dev Tauri product name");
    expect(releaseWorkflow).toContain("Validate release build contamination contract");
    expect(releaseWorkflow).toContain("pnpm run check:release-contamination");
    expect(releaseContaminationChecker).toContain(
      "release capability must not include debug-only MCP bridge permissions",
    );
    expect(releaseContaminationChecker).toContain(
      'release build must keep the MCP bridge plugin behind cfg(all(debug_assertions, feature = "mcp-bridge"))',
    );
    expect(releaseContaminationChecker).toContain(
      "tauri-plugin-mcp-bridge dependency must be declared with optional = true",
    );
    expect(releaseContaminationChecker).toContain(
      "release dependency graph (cargo tree without --features mcp-bridge) must not include tauri-plugin-mcp-bridge",
    );
    expect(releaseContaminationChecker).toContain("release build must keep dev browser mocks disabled inside Tauri");
    expect(releaseContaminationChecker).toContain(
      "release source must not import dev-only mock data or scenario modules",
    );
    expect(releaseContaminationChecker).toContain("release source must not statically import dev browser mocks");
    expect(packageJson.scripts).toMatchObject({
      "check:release-contamination": "node ./scripts/check-release-build-contamination.ts",
    });
    expect(tauriLib).toMatch(
      /#\[cfg\(all\(debug_assertions, feature = "mcp-bridge"\)\)\]\s*let builder = builder\.plugin\(\s*tauri_plugin_mcp_bridge::Builder::new\(\)/,
    );
    expect(cargoToml).toMatch(/tauri-plugin-mcp-bridge\s*=\s*\{[^}]*optional\s*=\s*true/);
    expect(cargoToml).toMatch(/mcp-bridge\s*=\s*\[[^\]]*dep:tauri-plugin-mcp-bridge/);
    expect(devMocks).toContain(
      "if (window.__TAURI_INTERNALS__ && !window.__DEV_BROWSER_MOCKS__) return restoreWindowGlobals;",
    );
    expect(
      normalizeCapabilities(defaultCapability).flatMap(
        (capability) =>
          capability.permissions
            ?.map(permissionIdentifier)
            .filter((permission) => permission.startsWith("mcp-bridge:")) ?? [],
      ),
    ).toEqual([]);
    expect(tauriActionBlock).not.toContain("--config src-tauri/tauri.dev.conf.json");
    expect(releaseWorkflow).not.toMatch(/\bDEV_CREDENTIALS\s*:/);
    expect(releaseWorkflow).not.toMatch(/\bULTRA_RSS_DEV_CREDENTIALS\s*:/);
  });

  it("keeps single-instance and deep-link routing behind lifecycle state gates", () => {
    expect(tauriLib).toContain('const MAIN_WINDOW_CLOSE_BLOCKED_EVENT: &str = "main-window-close-blocked";');
    expect(tauriLib).toContain("commands::updater_commands::is_update_download_in_flight()");
    expect(tauriLib).toContain("MainWindowCloseDecision::BlockNativeOperationInFlight");
    expect(tauriLib).toContain("SecondLaunchDecision::FocusAndReportNativeOperationInFlight");
  });

  it("keeps Tauri identifiers and seed data directories collision-proof across dev and production", () => {
    const seedDevDatabaseScript = readText("scripts/seed-dev-db-from-prod.ts");

    expect(tauriConfig.identifier).toBe(PROD_TAURI_IDENTIFIER);
    expect(tauriReleaseConfig.identifier).toBe(PROD_TAURI_IDENTIFIER);
    expect(tauriDevConfig.identifier).toBe(DEV_TAURI_IDENTIFIER);
    expect(tauriDevConfig.identifier).not.toBe(tauriConfig.identifier);
    expect(tauriDevConfig.productName).not.toBe(tauriConfig.productName);

    expect(seedDevDatabaseScript).toContain(`const PROD_APP_IDENTIFIER = "${PROD_TAURI_IDENTIFIER}";`);
    expect(seedDevDatabaseScript).toContain(`const DEV_APP_IDENTIFIER = "${DEV_TAURI_IDENTIFIER}";`);
    expect(seedDevDatabaseScript).toContain('readConfiguredEnvValue(env, "ULTRA_RSS_PROD_APP_DATA_DIR")');
    expect(seedDevDatabaseScript).toContain('readConfiguredEnvValue(env, "ULTRA_RSS_DEV_APP_DATA_DIR")');
    expect(seedDevDatabaseScript).toContain("Production and Dev app data directories resolve to the same path.");
    expect(seedDevDatabaseScript).toContain("Refusing to seed from a Dev app data directory.");
    expect(seedDevDatabaseScript).toContain("Refusing to seed a non-Dev app data directory.");
    expect(seedDevDatabaseScript).toContain(".ultra-rss-reader-dev-app-data");
  });

  it("requires provider account kind additions to update capability and add-account contracts", () => {
    expect(providerSource).toContain("provider_capability_matrix_is_fixed_by_account_kind");
    expect(providerSource).toContain("supports_read_state_mutations");
    expect(providerSource).toContain("supports_star_state_mutations");
    expect(providerSource).toContain("optimistic_mutation_conflict_policy");
    expect(providerSource).toContain("ProviderSideDeletionRetention::DeleteLocal");
    expect(addAccountFormSource).toContain('case "FreshRss":');
    expect(addAccountFormSource).toContain("requiresCredentials: true");
    expect(addAccountServicesSource).toContain('nameKey: "account.freshrss"');
    expect(addAccountServicesSource).toContain('descKey: "account.freshrss_desc"');
  });

  it("generates a visible Rust and TypeScript enum drift table for release-facing contracts", () => {
    const contracts: EnumDriftContract[] = [
      {
        name: "AddAccountProviderKind",
        rust: extractEnabledServiceKinds(addAccountServicesSource),
        typescript: extractTypeScriptUnionValues(addAccountFormSource, "AddAccountProviderKind"),
        labels: extractEnabledServiceKinds(addAccountServicesSource),
        unknownFallback: "ProviderKind::Quarantined keeps unknown persisted account rows visible",
      },
      {
        name: "PlatformKind",
        rust: extractRustEnumVariants(readText("src-tauri/src/commands/dto/platform.rs"), "PlatformKindDto").map(
          toSnakeCase,
        ),
        typescript: extractTypeScriptStringArray(platformConstantsSource, "PLATFORM_KINDS"),
        labels: extractTypeScriptStringArray(platformConstantsSource, "PLATFORM_KINDS"),
        unknownFallback: "PlatformInfoSchema falls back to DEFAULT_PLATFORM_INFO",
      },
      {
        name: "ConnectionVerificationStatus",
        rust: rustStringValuesFromMatchArm(sqliteAccountSource, "verification_status_to_str"),
        typescript: rustStringValuesFromMatchArm(sqliteAccountSource, "verification_status_to_str"),
        labels: rustStringValuesFromMatchArm(sqliteAccountSource, "verification_status_to_str"),
        unknownFallback: "unknown persisted status is returned as a quarantined account",
      },
    ];
    const rows = buildEnumDriftRows(contracts);
    const generatedTable = formatEnumDriftTable(rows);

    expect(generatedTable).toContain("| Enum | Rust | TypeScript | Labels | Unknown fallback | Drift |");
    expect(generatedTable).toContain("AddAccountProviderKind");
    expect(generatedTable).toContain("PlatformKind");
    expect(generatedTable).toContain("ConnectionVerificationStatus");
    expect(rows.map((row) => row.drift)).toEqual(["ok", "ok", "ok"]);
  });

  it("generates a migration changelog with numbering, ownership, and destructive markers", () => {
    const migrationChangelog = generateMigrationChangelog();
    const migrationVersions = migrationChangelog.map((entry) => entry.version);
    const latestMigrationVersion = Math.max(...migrationVersions, ...INLINE_MIGRATION_VERSIONS);

    expect(new Set(migrationVersions).size).toBe(migrationVersions.length);
    for (let version = 1; version <= latestMigrationVersion; version += 1) {
      expect(
        migrationVersions.includes(version) || INLINE_MIGRATION_VERSIONS.includes(version),
        `migration v${version} must have a file or an inline repair owner`,
      ).toBe(true);
    }
    for (const entry of migrationChangelog) {
      expect(entry.description, entry.fileName).toMatch(/^[a-z0-9]+(?:_[a-z0-9]+)*$/);
      expect(entry.owner, entry.fileName).not.toBe("");
      if (entry.destructive) {
        expect(readText(`${MIGRATION_DIR}/${entry.fileName}`), entry.fileName).toContain(DESTRUCTIVE_MIGRATION_MARKER);
      }
    }
    expect(tauriLib).toContain("fn migration_error_message_includes_restore_steps()");
    expect(readMigrationModuleSource()).toContain("fn fresh_db_migrates_to_latest()");
  });

  it("checks repository SQL strings against migration-defined table, column, and index inventory", () => {
    const repositorySources = listRepoFiles("src-tauri/src/infra/db")
      .filter((path) => path.endsWith(".rs"))
      .map((file) => ({ file, source: readText(file) }));
    const report = analyzeRepositorySqlInventory({
      migrationSources: readMigrationSources(MIGRATION_DIR),
      repositorySources,
    });
    const formattedReport = formatRepositorySqlInventoryReport(report);

    expect(formattedReport).toContain("migration tables:");
    expect(formattedReport).toContain("migration columns:");
    expect(formattedReport).toContain("dynamic SQL allowlist:");
    expect(formattedReport).toContain("parser limits:");
    expect(report.references.length).toBeGreaterThan(0);
    expect(report.migrationInventory.tables).toContain("accounts");
    expect(report.migrationInventory.columnsByTable.get("accounts")).toContain("sync_on_startup");
    expect(report.migrationInventory.indexes).toContain("idx_pending_mutations_unique_entry_type");
    expect(report.unknownTables, formattedReport).toEqual([]);
    expect(report.unknownIndexes, formattedReport).toEqual([]);
    expect(report.unknownColumns, formattedReport).toEqual([]);
  });

  it("keeps stale update installs gated by updater policy and database schema compatibility", () => {
    expect(updaterCommandsSource).toContain("pending.0.lock().await.clear()");
    expect(updaterCommandsSource).toContain("pending_update_metadata_matches");
    expect(updaterCommandsSource).toContain("fn pending_update_metadata_contract_rejects_changed_version_or_source()");
    expect(updaterCommandsSource).toContain("Pending update handle changed before install");
    expect(updaterCommandsSource).toContain("update_policy_error(&pending_update.update)");
    expect(updaterCommandsSource).toContain("restore_if_unchanged(take_generation, pending_update)");
    expect(updaterCommandsSource).toContain("Downgrade or same-version update is not allowed");
    expect(updaterCommandsSource).toContain("Unsupported update channel");
    expect(updaterCommandsSource).toContain("Prerelease update is not allowed");

    expect(migrationSource).toContain("pub const LATEST_VERSION");
    expect(migrationSource).toContain("if from_version > LATEST_VERSION");
    expect(migrationSource).toContain("if version > LATEST_VERSION");
    expect(migrationSource).toContain("Downgrade startup is blocked to avoid data loss");
    expect(migrationSource).toContain("fn future_schema_version_blocks_downgrade_migration()");
  });

  it("keeps native menu action payloads aligned with frontend AppAction ids", () => {
    const nativeMenuActions = extractNativeMenuActionContracts(nativeMenuSource);
    const appActions = extractAppActions(appActionsSource);

    expect(nativeMenuActions.get("unknown-menu-id")).toBeUndefined();

    for (const [menuId, action] of nativeMenuActions) {
      expect(appActions.has(action), `${menuId} emits ${action}, but APP_ACTIONS does not accept it`).toBe(true);
    }
    expect(appActions.has("unknown-action-payload")).toBe(false);
    expect(appActions.has("disabled-runtime-action")).toBe(false);
  });

  it("keeps native menu item action ids aligned with customizable shortcut definitions", () => {
    const nativeMenuActions = extractNativeMenuActionContracts(nativeMenuSource);
    const shortcutActionIds = extractShortcutActionIds(keyboardShortcutsSource);
    const menuActionShortcutContracts = [
      ["item-prev", "prev-article", "prev_article"],
      ["item-next", "next-article", "next_article"],
      ["item-reader", "open-in-reader", "open_in_app_browser"],
      ["item-browser", "open-in-browser", "open_external_browser"],
      ["item-toggle-star", "toggle-star", "toggle_star"],
      ["item-toggle-read", "toggle-read", "toggle_read"],
      ["item-mark-all-read", "mark-all-read", "mark_all_read"],
    ] as const;

    for (const [menuId, action, shortcutActionId] of menuActionShortcutContracts) {
      expect(nativeMenuActions.get(menuId)).toBe(action);
      expect(shortcutActionIds.has(shortcutActionId)).toBe(true);
    }
    expect(nativeMenuActions.get("accounts-sync")).toBe("sync-all");
  });

  it("keeps native menu preference keys aligned with frontend preference keys", () => {
    const nativeMenuPrefKeys = new Set(
      [...nativeMenuSource.matchAll(/prefs\s*\.get\("([^"]+)"\)/g)].map((match) => match[1]),
    );

    expect(nativeMenuPrefKeys.size).toBeGreaterThan(0);
    const frontendPreferenceSources = `${preferenceValuesSource}\n${preferencesStoreSource}`;
    for (const key of nativeMenuPrefKeys) {
      expect(frontendPreferenceSources, `native menu reads unknown preference key "${key}"`).toContain(`"${key}"`);
    }
  });

  it("keeps native checked menu toggles rolled back when the action emit fails", () => {
    expect(nativeMenuSource).toContain("should_rollback_check_toggle_after_emit(toggled_check_item, true)");
  });

  it("generates a release/debug feature flag inventory report", { timeout: 30_000 }, () => {
    execFileSync("node", ["./scripts/release-debug-feature-flags-report.ts"], {
      encoding: "utf8",
    });
    const report: {
      generatedBy: string;
      inventory: {
        area: string;
        flag: string;
        debugBehavior: string;
        releaseBehavior: string;
        evidence: string[];
      }[];
    } = JSON.parse(readText("tmp/release-debug-feature-flags.json"));

    expect(packageJson.scripts).toMatchObject({
      "report:release-debug-flags": "node ./scripts/release-debug-feature-flags-report.ts",
    });
    expect(report.generatedBy).toBe("scripts/release-debug-feature-flags-report.ts");
    for (const item of report.inventory) {
      expect(item.evidence.length, item.flag).toBeGreaterThan(0);
      expect(item.debugBehavior, item.flag).not.toBe("");
      expect(item.releaseBehavior, item.flag).not.toBe("");
    }
  });

  it("keeps dependency audit CI-enforced under the advisory policy", () => {
    expect(extractTaskBlock(miseToml, "audit:deps")).toContain("CI-enforced dependency audit");
    expect(extractTaskBlock(miseToml, "audit:deps")).toContain("pnpm audit --prod --audit-level high");
    expect(extractTaskBlock(miseToml, "audit:deps:rust")).toContain("cargo audit --file src-tauri/Cargo.lock");
    expect(ciWorkflow).toContain("mise run audit:deps");
    expect(ciWorkflow).toContain("mise run audit:deps:rust");
    expect(releaseWorkflow).not.toMatch(/\b(?:pnpm|cargo)\s+audit\b/);
    expect(miseToml).not.toMatch(/depends = \[[^\]]*"audit:deps"/);
  });

  it("keeps markdownlint glob and ignore patterns under a repo contract", () => {
    const markdownlintConfig = parseJsonc(readText(".markdownlint-cli2.jsonc")) as {
      globs?: string[];
      ignores?: string[];
    };
    const markdownFiles = listRepoFiles()
      .filter((path) => path.endsWith(".md"))
      .filter((path) => !isMarkdownlintIgnoredPath(path))
      .sort((left, right) => left.localeCompare(right));

    expect(markdownlintConfig.globs).toEqual([markdownlintRepoContract.glob]);
    expect(markdownlintConfig.ignores).toEqual([...markdownlintRepoContract.ignorePatterns]);
    expect(markdownlintRepoContract.rootMarkdownFiles.every((path) => markdownFiles.includes(path))).toBe(true);
    expect(markdownFiles.some((path) => path.startsWith("src-tauri/gen/"))).toBe(false);
    expect(extractTaskBlock(miseToml, "quality:markdownlint-contract")).toContain(
      "Check markdownlint glob and ignore pattern contract",
    );
    expect(miseToml).toContain("src-tauri/gen/**");
  });

  it("keeps generated fixture, snapshot, and report artifact size budgets under a repo contract", () => {
    const repoFiles = listRepoFiles();
    const fixtureFiles = repoFiles.filter((path) =>
      generatedFixtureSnapshotSizeBudget.fixturePathPrefixes.some((prefix) => path.startsWith(prefix)),
    );
    const oversizedFixtureFiles = fixtureFiles.filter(
      (path) => statSync(path).size > generatedFixtureSnapshotSizeBudget.maxCheckedInFixtureBytes,
    );

    expect(fixtureFiles.length).toBeGreaterThan(0);
    expect(oversizedFixtureFiles).toEqual([]);
    expect(
      generatedFixtureSnapshotSizeBudget.generatedReportIgnoredPathPrefixes.every((prefix) =>
        qualityBaselineRepoScanIgnoredPathPrefixes.includes(prefix),
      ),
    ).toBe(true);
    expect(isGeneratedReportArtifactPath("tmp/release-debug-feature-flags.json")).toBe(true);
    expect(isGeneratedReportArtifactPath("tests/fixtures/opml/generated-basic.opml")).toBe(false);
  });

  it("keeps live provider tests opt-in and secret-masked outside the default repo gate", () => {
    const normalizedReleaseManualVerification = releaseManualVerification.replace(/\s+/g, " ");

    expect(extractTaskBlock(miseToml, liveProviderTestGateContract.taskName)).not.toBe("");
    for (const fragment of liveProviderTestGateContract.commandFragments) {
      expect(miseToml).toContain(fragment);
    }
    expect(miseToml).not.toMatch(new RegExp(`depends = \\[[^\\]]*"${liveProviderTestGateContract.taskName}"`));
    expect(greaderProviderSource).toContain("skip_live_freshrss_test_when_env_is_missing");
    for (const envKey of liveProviderTestGateContract.requiredEnvKeys) {
      expect(greaderProviderSource).toContain(`std::env::var("${envKey}")`);
    }
    expect(normalizedReleaseManualVerification).toContain(liveProviderTestGateContract.localGateExclusionPolicy);
    expect(normalizedReleaseManualVerification).toContain(liveProviderTestGateContract.maskingPolicy);
  });

  it("keeps release note category labels covered by issue and PR label contracts", () => {
    const issueTemplateLabels = issueTemplateFileNames.flatMap((fileName) =>
      extractYamlInlineListValues(readText(`.github/ISSUE_TEMPLATE/${fileName}`), "labels"),
    );
    const contractLabels = new Set([...extractYamlTopLevelKeys(labelerConfig), ...issueTemplateLabels]);

    for (const label of extractYamlLabelsFields(releaseConfig)) {
      expect(contractLabels.has(label), `${label} is not covered by issue templates or .github/labeler.yml`).toBe(true);
    }
  });

  it("keeps local labeler and PR insights labeler source-of-truth split explicit", () => {
    const localLabelerLabels = extractYamlTopLevelKeys(labelerConfig);
    const releaseLabels = extractYamlLabelsFields(releaseConfig);
    const prInsightsOwnedPrefixes = ["risk/", "size/"];

    expect(labelerConfig).toContain("this file owns area and release-category labels");
    expect(labelerWorkflow).toContain(".github/labeler.yml owns area and release-category labels");
    expect(prInsightsLabelerWorkflow).toContain("PR Insights owns risk/* and size/* labels only");
    expect(
      localLabelerLabels.filter((label) => prInsightsOwnedPrefixes.some((prefix) => label.startsWith(prefix))),
    ).toEqual([]);
    expect(releaseLabels.filter((label) => prInsightsOwnedPrefixes.some((prefix) => label.startsWith(prefix)))).toEqual(
      [],
    );
  });

  it("rejects every action whose only event receiver lives in the article pane when no article is selected", () => {
    const actionsSource = readText("src/lib/actions.ts");
    const runArticleActionSource = actionsSource.slice(actionsSource.indexOf("function runArticleAction"));
    const eventNameByAction = new Map<string, string>();
    for (const match of runArticleActionSource.matchAll(
      /case "([^"]+)":\s*(?:emitEvent|emitArticleShareEvent)\(\s*keyboardEvents\.(\w+)\)/g,
    )) {
      eventNameByAction.set(match[1], match[2]);
    }

    const receiverSourcesByEventName = new Map<string, string[]>();
    const sourcePaths = readdirSync("src", { recursive: true, encoding: "utf8" }).filter(
      (path) => /\.tsx?$/.test(path) && !/(^|\/)__tests__\/|\.(test|stories)\.tsx?$/.test(path),
    );
    for (const path of sourcePaths) {
      const source = readText(join("src", path));
      for (const match of source.matchAll(/(?:type:\s*|addEventListener\(\s*)keyboardEvents\.(\w+)/g)) {
        receiverSourcesByEventName.set(match[1], [...(receiverSourcesByEventName.get(match[1]) ?? []), source]);
      }
    }

    const articlePaneOnlyActions = [...eventNameByAction]
      .filter(([, eventName]) => {
        const receivers = receiverSourcesByEventName.get(eventName) ?? [];
        return (
          receivers.length > 0 &&
          receivers.every((source) => source.includes("export function useArticlePaneShortcuts"))
        );
      })
      .map(([action]) => action)
      .sort();

    const noArticleContext = {
      selectedAccountId: "acc-1",
      selectedArticleId: null,
      contentMode: "reader",
      commandPaletteOpen: false,
      settingsOpen: false,
      shortcutsHelpOpen: false,
      isAddFeedDialogOpen: false,
    } as const;
    const requiresArticleActions = APP_ACTIONS.filter(
      (action) => getAppActionUnavailableReason(action, "nativeMenu", noArticleContext) === "requires-article",
    ).sort();

    expect(articlePaneOnlyActions).toContain("toggle-star");
    expect(requiresArticleActions).toEqual(articlePaneOnlyActions);
  });
});
