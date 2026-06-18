import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  generatedFixtureSnapshotSizeBudget,
  isGeneratedReportArtifactPath,
  liveProviderTestGateContract,
  markdownlintRepoContract,
  qualityBaselineRepoScanIgnoredPathPrefixes,
  testHelperRuntimeIsolationContract,
} from "../scripts/quality-baseline";
import {
  analyzeRepositorySqlInventory,
  buildEnumDriftRows,
  type EnumDriftContract,
  formatEnumDriftTable,
  formatRepositorySqlInventoryReport,
  readMigrationSources,
} from "../scripts/repo-contract-inventory";
import {
  extractIssueTemplateDoneWhenDescription,
  extractIssueTemplateDoneWhenPlaceholder,
  extractYamlInlineListValues,
  extractYamlLabelsFields,
  extractYamlTopLevelKeys,
} from "./helpers/repo-contract-parser";

type PackageJson = {
  name: string;
  private: boolean;
  scripts: Record<string, string>;
  version: string;
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
  [/^sync_/, "sync"],
  [/^mute_/, "mute-keywords"],
  [/^article_/, "articles"],
  [/^remove_inoreader$/, "accounts"],
] as const;
const PACKAGED_WINDOW_ICON_PATHS = [
  "icons/32x32.png",
  "icons/128x128.png",
  "icons/128x128@2x.png",
  "icons/icon.icns",
  "icons/icon.ico",
] as const;
const MOBILE_ICON_ASSET_HASHES = {
  "icons/android/mipmap-anydpi-v26/ic_launcher.xml": "760d4b8a06bf7163dd010c33ad2cac9e4a75fa0177afaba042f83e311eef0c3e",
  "icons/android/mipmap-hdpi/ic_launcher.png": "75ab910077e745762b3c19ce91ab6606b48bf48749d9c643baf0567cd1d17c10",
  "icons/android/mipmap-hdpi/ic_launcher_foreground.png":
    "161649a4e1195cdee7a41f6549381d6eae066a2e68693f7b2a0dd7963bb34a58",
  "icons/android/mipmap-hdpi/ic_launcher_round.png": "5e6c92a894078957666b90f2fc8efb8c9e95c9d16a0ede6098d7f627ea2025d1",
  "icons/android/mipmap-mdpi/ic_launcher.png": "3ce45ae095e68d72c07e865bd621e8bd3ce9d3799f44f33ce15f749825a9ab56",
  "icons/android/mipmap-mdpi/ic_launcher_foreground.png":
    "20433e3f07527e9a1a788f52886583a3140d302d1e744d028ce785cc9077abbb",
  "icons/android/mipmap-mdpi/ic_launcher_round.png": "e4d23648b41f28e6067f49c727c950acec80a7df86d1355dbe9553d0003bfbc6",
  "icons/android/mipmap-xhdpi/ic_launcher.png": "55aa6f966e75796a16a3efd619541cd0d11eceed1c509e1af40b21eba2f91948",
  "icons/android/mipmap-xhdpi/ic_launcher_foreground.png":
    "291cdef4f2b6aa7ab39d1678922b8ef7601452e2c571080f38c309262ea1e562",
  "icons/android/mipmap-xhdpi/ic_launcher_round.png":
    "d8854c27697257941dbcdd90ee920791881700eae78780bba2465fe6b5ecca32",
  "icons/android/mipmap-xxhdpi/ic_launcher.png": "6e31d70ff9ef085d023bed8464dbb458670bbdd9a6ad495e04a2ce0c82e804c0",
  "icons/android/mipmap-xxhdpi/ic_launcher_foreground.png":
    "07682e05b622a51882bc80efc88676a4fe86f1262d3df1cd7feaf08322d3ecb1",
  "icons/android/mipmap-xxhdpi/ic_launcher_round.png":
    "2dbcf433575e11daf6a79f8f1598a8bce7392b2751f3aaa53d7f64de25af42ee",
  "icons/android/mipmap-xxxhdpi/ic_launcher.png": "d0fd2ff0daa1677f55287401ae78ffe6535adf59995b536671405bdea733bf44",
  "icons/android/mipmap-xxxhdpi/ic_launcher_foreground.png":
    "9f5a1f5c89f66ff9e83668cf23bfad69e4288006e93e1266feda130a7425379d",
  "icons/android/mipmap-xxxhdpi/ic_launcher_round.png":
    "b15bdbc40001b0cafb2e2352698d0afc9b99d4c2a67d63045137ec26b21cf0bb",
  "icons/android/values/ic_launcher_background.xml": "0687336f0ccc6f7ee09c7c95110667c63b75931238df779a21af401fb864cd34",
  "icons/ios/AppIcon-20x20@1x.png": "c8f9dc853b01c5ad89f7c22f3e28558eadfc5898389484a730a19344d2ab06cd",
  "icons/ios/AppIcon-20x20@2x-1.png": "12927bc96a63bd13dd79d792e8625388d57061325c34df28049207b2600a61a3",
  "icons/ios/AppIcon-20x20@2x.png": "12927bc96a63bd13dd79d792e8625388d57061325c34df28049207b2600a61a3",
  "icons/ios/AppIcon-20x20@3x.png": "7845d6efbdb6eba1a66bd5b683c35c5153e6a2132fab3c2634e128bd2514183a",
  "icons/ios/AppIcon-29x29@1x.png": "16195adc8513968986255c86f0b9a39493a3dc1ca10a766b877a175d66652087",
  "icons/ios/AppIcon-29x29@2x-1.png": "b81826b2a42b24cbc26b63144ce9ebabeb2ea345a3e3a47a4f6d8e861dd16429",
  "icons/ios/AppIcon-29x29@2x.png": "b81826b2a42b24cbc26b63144ce9ebabeb2ea345a3e3a47a4f6d8e861dd16429",
  "icons/ios/AppIcon-29x29@3x.png": "3e0ed19c4c230e7c36963ea18336e4d4f73d72b07e8633f58b67f254a92e2b02",
  "icons/ios/AppIcon-40x40@1x.png": "12927bc96a63bd13dd79d792e8625388d57061325c34df28049207b2600a61a3",
  "icons/ios/AppIcon-40x40@2x-1.png": "220be6e8e4b497466eeb0a0ed144874192c662dcd4d19390c89b89bb349454d8",
  "icons/ios/AppIcon-40x40@2x.png": "220be6e8e4b497466eeb0a0ed144874192c662dcd4d19390c89b89bb349454d8",
  "icons/ios/AppIcon-40x40@3x.png": "594e35e40cba71034cdefef0b2060dfc921bbbd0b5334e35a329db6b6177027a",
  "icons/ios/AppIcon-512@2x.png": "780eb646c0e30e0ea75cf155814fa6c2638ba48c6d9ff496b06775832084c88f",
  "icons/ios/AppIcon-60x60@2x.png": "594e35e40cba71034cdefef0b2060dfc921bbbd0b5334e35a329db6b6177027a",
  "icons/ios/AppIcon-60x60@3x.png": "29a72741769156adb566a64f0f078b70c17affbbef5ebf30cee3786431733073",
  "icons/ios/AppIcon-76x76@1x.png": "02184e4fbdf23b4f3c09508f1b40492f81b0081ba3e3ab5652cb23704347bbd8",
  "icons/ios/AppIcon-76x76@2x.png": "2af04f10ae235a52702a9ce45f4ea2f079c7bc2f0565d96d92a78fe039bba0e1",
  "icons/ios/AppIcon-83.5x83.5@2x.png": "3e5a08f0e1cc8f24d56e6798855131b07e02fad99f60144c516f93ec03a5e9b7",
} as const;
const UPDATER_PUBKEY_PLACEHOLDER_PATTERN = /(?:placeholder|change[_-]?me|todo)/i;
const RELEASE_UPDATER_ASSET_CONTRACT = [
  {
    assetPattern: ".app.tar.gz",
    artifactArch: "aarch64",
    artifactPlatform: "darwin",
    checksumPattern: ".app.tar.gz.sha256",
    matrixArgs: "--target aarch64-apple-darwin",
    matrixPlatform: "macos-latest",
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
const readSha256 = (path: string): string => createHash("sha256").update(readFileSync(path)).digest("hex");

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

const extractReleaseCacheBlock = (source: string): string => {
  const value = source.match(
    /- uses: actions\/cache@27d5ce7f107fe9357f9df03efb73ab90386fccae\n(?<block>(?: {8}.+\n?)*)/,
  )?.groups?.block;
  if (!value) {
    throw new Error("Missing release pnpm cache block");
  }
  return value;
};

const extractTaskBlock = (source: string, taskName: string): string => {
  const escapedTaskName = escapeRegExp(taskName);
  const value = source.match(
    new RegExp(`\\[tasks\\."${escapedTaskName}"\\]\\n(?<block>[\\s\\S]*?)(?=\\n\\[tasks\\.|$)`),
  )?.groups?.block;
  if (!value) {
    throw new Error(`Missing mise task block: ${taskName}`);
  }
  return value;
};

const extractCacheBlocks = (source: string): string[] => {
  const cachePattern = /- uses: actions\/cache@[^\n]+\n(?<block>(?: {8}.+\n?)*)/g;
  return [...source.matchAll(cachePattern)].map((match) => match.groups?.block ?? "");
};

const extractWorkflowUses = (source: string): string[] => {
  const usesPattern = /^\s*(?:-\s+)?uses:\s+([^\s#]+)\s*$/gm;
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

const capabilityByIdentifier = (source: TauriCapabilityFile, identifier: string): TauriCapability => {
  const capability = normalizeCapabilities(source).find((entry) => entry.identifier === identifier);
  if (!capability) {
    throw new Error(`Missing Tauri capability: ${identifier}`);
  }
  return capability;
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
  const value = source.match(
    /- uses: tauri-apps\/tauri-action@84b9d35b5fc46c1e45415bdb6144030364f7ebc5\n(?<block>(?: {8}.+\n?)*)/,
  )?.groups?.block;
  if (!value) {
    throw new Error("Missing release tauri-action block");
  }
  return value;
};

const listTypeScriptSourceFiles = (dir: string): string[] =>
  readdirSync(dir, { recursive: true })
    .filter((entry): entry is string => typeof entry === "string")
    .filter((entry) => /\.(?:ts|tsx)$/.test(entry))
    .map((entry) => normalizeRepoPath(`${dir}/${entry}`));

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

describe("release repository contract", () => {
  const packageJson: PackageJson = JSON.parse(readText("package.json"));
  const tauriConfig: TauriConfig = JSON.parse(readText("src-tauri/tauri.conf.json"));
  const tauriReleaseConfig: TauriConfig = JSON.parse(readText("src-tauri/tauri.release.conf.json"));
  const tauriDevConfig: TauriConfig = JSON.parse(readText("src-tauri/tauri.dev.conf.json"));
  const defaultCapability: TauriCapabilityFile = JSON.parse(readText("src-tauri/capabilities/default.json"));
  const cargoToml = readText("src-tauri/Cargo.toml");
  const releaseWorkflow = readText(".github/workflows/release.yml");
  const releaseSourceValidator = readText("scripts/release/validate-source.ts");
  const releaseVersionValidator = readText("scripts/release/validate-version-parity.ts");
  const releaseArtifactsScript = readText("scripts/release/artifacts.ts");
  const releaseContaminationChecker = readText("scripts/check-release-build-contamination.ts");
  const tauriLib = readText("src-tauri/src/lib.rs");
  const updaterCommandsSource = readText("src-tauri/src/commands/updater_commands.rs");
  const migrationSource = readText("src-tauri/src/infra/db/migration.rs");
  const devMocks = readText("src/dev/mocks.ts");
  const feedContentPrivacy = readText("docs/feed-content-privacy.md");
  const incidentRunbook = readText("docs/incident-runbook.md");
  const readerKeyboardNavigation = readText("docs/reader-keyboard-navigation.md");
  const releaseManualVerification = readText("docs/release-manual-verification.md");
  const docsReadme = readText("docs/README.md");
  const ciWorkflow = readText(".github/workflows/ci.yml");
  const labelerWorkflow = readText(".github/workflows/labeler.yml");
  const prInsightsLabelerWorkflow = readText(".github/workflows/pr-insights-labeler.yml");
  const releaseConfig = readText(".github/release.yml");
  const labelerConfig = readText(".github/labeler.yml");
  const pullRequestTemplate = readText(".github/PULL_REQUEST_TEMPLATE.md");
  const issueTemplateFileNames = readdirSync(".github/ISSUE_TEMPLATE").filter(
    (fileName) => fileName.endsWith(".yml") && fileName !== "config.yml",
  );
  const miseToml = readText("mise.toml");
  const nativeMenuSource = readText("src-tauri/src/menu.rs");
  const appActionsSource = readText("src/lib/app-actions.ts");
  const appIconThemeSource = readText("src/hooks/use-app-icon-theme.ts");
  const platformSource = readText("src-tauri/src/platform/mod.rs");
  const keyboardShortcutsSource = readText("src/lib/keyboard/keyboard-shortcuts.ts");
  const preferencesSchemaSource = readText("src/schemas/preferences.ts");
  const preferencesStoreSource = readText("src/stores/preferences-store.ts");
  const providerSource = readText("src-tauri/src/domain/provider.rs");
  const sqliteAccountSource = readText("src-tauri/src/infra/db/sqlite_account.rs");
  const platformConstantsSource = readText("src/constants/platform.ts");
  const providerHttpDefaultsSource = readText("src-tauri/src/infra/provider/http_defaults.rs");
  const localProviderSource = readText("src-tauri/src/infra/provider/local.rs");
  const accountCommandsSource = readText("src-tauri/src/commands/account_commands.rs");
  const opmlCommandsSource = readText("src-tauri/src/commands/opml_commands.rs");
  const greaderProviderSource = readText("src-tauri/src/infra/provider/greader.rs");
  const testSetupSource = readText(testHelperRuntimeIsolationContract.sharedSetupPath);
  const testIsolationPolicySource = readText(testHelperRuntimeIsolationContract.policyTestPath);
  const articleContentViewTest = readText("src/__tests__/components/article-content-view.test.tsx");
  const feedDiscoverySource = readText("src-tauri/src/infra/feed_discovery.rs");
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
    expect(releaseWorkflow).not.toContain("node <<'NODE'");
    expect(releaseWorkflow).toContain("Validate release version parity");
    expect(releaseWorkflow).toContain("node ./scripts/release/validate-version-parity.ts");
    expect(releaseVersionValidator).toContain("release tag $" + "{releaseTag}");
    expect(releaseVersionValidator).toContain("src-tauri/tauri.conf.json version");
    expect(releaseVersionValidator).toContain("src-tauri/Cargo.toml version");
  });

  it("serializes tag push and manual release runs by release tag", () => {
    expect(releaseWorkflow).toContain(
      "group: $" +
        "{{ github.workflow }}-$" +
        "{{ github.event_name == 'workflow_dispatch' && inputs.release_tag || github.ref_name }}",
    );
    expect(releaseWorkflow).toContain("cancel-in-progress: false");
    expect(releaseWorkflow).toContain("workflow_dispatch");
    expect(releaseWorkflow).toContain("push:");
    expect(releaseWorkflow).toContain('tags: ["v*"]');
  });

  it("checks release source and version parity before artifact creation", () => {
    expect(releaseWorkflow).toContain("Validate release source");
    expect(releaseWorkflow).toContain(["ref: $", "{{ github.ref }}"].join(""));
    expect(releaseWorkflow).not.toContain("format('refs/tags/{0}', inputs.release_tag)");
    expect(releaseWorkflow).toContain("node ./scripts/release/validate-source.ts");
    expect(releaseSourceValidator).toContain('eventName === "push"');
    expect(releaseSourceValidator).toContain('eventName === "workflow_dispatch"');
    expect(releaseSourceValidator).toContain(
      "tag push ref $" + "{workflowRef} does not match release tag $" + "{releaseTag}",
    );
    expect(releaseSourceValidator).toContain(
      "manual dispatch ref $" + "{workflowRef} does not match release tag $" + "{releaseTag}",
    );
    expect(releaseSourceValidator).toContain(
      '["fetch", "--force", "--tags", "origin", `refs/tags/$' + "{releaseTag}:refs/tags/$" + "{releaseTag}`]",
    );
    expect(releaseSourceValidator).toContain(
      '["ls-remote", "--exit-code", "--tags", "origin", `refs/tags/$' + "{releaseTag}`]",
    );
    expect(releaseSourceValidator).toContain('["fetch", "--force", "origin", "main:refs/remotes/origin/main"]');
    expect(releaseSourceValidator).toContain('["cat-file", "-t", `refs/tags/$' + "{releaseTag}`]");
    expect(releaseSourceValidator).toContain("must be an annotated tag object");
    expect(releaseSourceValidator).toContain('["rev-parse", `refs/tags/$' + "{releaseTag}`]");
    expect(releaseSourceValidator).toContain('["rev-parse", `refs/tags/$' + "{releaseTag}^{}`]");
    expect(releaseSourceValidator).toContain('["checkout", "--detach", tagTargetSha]');
    expect(releaseSourceValidator).toContain('["rev-parse", "HEAD"]');
    expect(releaseSourceValidator).toContain("expected annotated tag metadata");
    expect(releaseSourceValidator).toContain(
      '["merge-base", "--is-ancestor", tagTargetSha, "refs/remotes/origin/main"]',
    );
    expect(releaseSourceValidator).toContain("is not reachable from origin/main");
    expect(releaseSourceValidator).toContain('process.env.REUSE_EXISTING_ASSETS === "true"');
    expect(releaseSourceValidator).toContain("release recovery is validating existing assets");
    expect(releaseWorkflow.indexOf("Validate release source")).toBeLessThan(
      releaseWorkflow.indexOf("Resolve pnpm store path"),
    );
    expect(releaseWorkflow.indexOf("Validate release version parity")).toBeLessThan(
      releaseWorkflow.indexOf("tauri-apps/tauri-action"),
    );
    expect(releaseWorkflow.indexOf("Run release quality preflight")).toBeLessThan(
      releaseWorkflow.indexOf("tauri-apps/tauri-action"),
    );
    expect(releaseWorkflow.indexOf("Validate release build contamination contract")).toBeLessThan(
      releaseWorkflow.indexOf("tauri-apps/tauri-action"),
    );
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

  it("keeps release dependency cache keyed by lockfile and toolchain drift", () => {
    const releaseCacheBlock = extractReleaseCacheBlock(releaseWorkflow);

    expect(releaseCacheBlock).toContain(
      "key: $" +
        "{{ runner.os }}-pnpm-store-toolchain-$" +
        "{{ hashFiles('mise.toml', 'package.json', 'pnpm-lock.yaml') }}",
    );
    expect(releaseCacheBlock).toContain("restore-keys:");
    expect(releaseCacheBlock).toContain("$" + "{{ runner.os }}-pnpm-store-toolchain-");
    expect(releaseCacheBlock).toContain("$" + "{{ runner.os }}-pnpm-store-");
  });

  it("keeps CI pnpm cache restore keys bounded by frozen lockfile installs", () => {
    const ciCacheBlocks = extractCacheBlocks(ciWorkflow);

    expect(ciCacheBlocks.length).toBeGreaterThan(0);
    for (const cacheBlock of ciCacheBlocks) {
      expect(cacheBlock).toContain(
        "key: $" +
          "{{ runner.os }}-pnpm-store-$" +
          "{{ hashFiles('pnpm-lock.yaml') }}-node-$" +
          "{{ steps.toolchain-cache.outputs.node }}-pnpm-$" +
          "{{ steps.toolchain-cache.outputs.pnpm }}-mise-$" +
          "{{ steps.toolchain-cache.outputs.mise }}",
      );
      expect(cacheBlock).toContain("restore-keys:");
      expect(cacheBlock).toContain(
        "$" +
          "{{ runner.os }}-pnpm-store-$" +
          "{{ hashFiles('pnpm-lock.yaml') }}-node-$" +
          "{{ steps.toolchain-cache.outputs.node }}-pnpm-$" +
          "{{ steps.toolchain-cache.outputs.pnpm }}-mise-$" +
          "{{ steps.toolchain-cache.outputs.mise }}-",
      );
      expect(cacheBlock).toContain("$" + "{{ runner.os }}-pnpm-store-");
    }
    expect(ciWorkflow.match(/pnpm install --frozen-lockfile/g)).toHaveLength(ciCacheBlocks.length);
    expect(ciWorkflow).not.toContain("node_modules");
  });

  it("pins third-party actions in all workflows to commit SHAs", () => {
    const workflows = [
      [".github/workflows/ci.yml", ciWorkflow],
      [".github/workflows/labeler.yml", labelerWorkflow],
      [".github/workflows/pr-insights-labeler.yml", prInsightsLabelerWorkflow],
      [".github/workflows/release.yml", releaseWorkflow],
    ] as const;

    for (const [workflowPath, workflow] of workflows) {
      const usesValues = extractWorkflowUses(workflow);

      expect(usesValues.length, workflowPath).toBeGreaterThan(0);
      for (const usesValue of usesValues) {
        expect(usesValue, workflowPath).toMatch(/@[0-9a-f]{40}$/i);
      }
    }

    expect(extractWorkflowUses(prInsightsLabelerWorkflow)).toContain(
      "jey3dayo/pr-insights-labeler@e9bccb2e8c9ed048d6022d6ae2e5c85eeed80f16",
    );
    expect(extractTaskBlock(miseToml, "lint:workflow-pins")).toContain("node scripts/check-workflow-pins.mjs");
    expect(readText("scripts/check-workflow-pins.mjs")).toContain('?? ".github/workflows"');
  });

  it("keeps workflow pin checker parsing quoted uses, inline comments, and local actions", () => {
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
          "      - uses: 'actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd' # pinned checkout",
          '      - uses: "jdx/mise-action@1648a7812b9aeae629881980618f079932869151"',
          "      - uses: ./.github/actions/local-tool",
          "      - uses: owner/repo/.github/workflows/reusable.yml@1234567890abcdef1234567890abcdef12345678",
        ].join("\n"),
      );

      expect(runWorkflowPinChecker(tempDir)).toBe("");
    } finally {
      rmSync(tempDir, { force: true, recursive: true });
    }
  });

  it("keeps workflow pin checker rejecting floating quoted uses", () => {
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
          "      - uses: 'actions/checkout@v6' # floating ref",
        ].join("\n"),
      );

      expect(() => runWorkflowPinChecker(tempDir)).toThrow(/actions\/checkout@v6 must use a 40-character commit SHA/);
    } finally {
      rmSync(tempDir, { force: true, recursive: true });
    }
  });

  it("keeps release workflow permissions limited to release asset publishing", () => {
    const releasePermissions = extractYamlScalarBlockEntries(extractTopLevelYamlBlock(releaseWorkflow, "permissions"));

    expect(releasePermissions).toEqual({ contents: "write" });
    expect(releaseWorkflow).not.toMatch(/^ {4}permissions:/m);
  });

  it("keeps release workflow action, token, and cache surfaces pinned to the release asset scope", () => {
    const releaseUsesValues = extractWorkflowUses(releaseWorkflow);
    const expectedReleaseActions = [
      "actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd",
      "jdx/mise-action@1648a7812b9aeae629881980618f079932869151",
      "actions/cache@27d5ce7f107fe9357f9df03efb73ab90386fccae",
      "actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd",
      "jdx/mise-action@1648a7812b9aeae629881980618f079932869151",
      "actions/cache@27d5ce7f107fe9357f9df03efb73ab90386fccae",
      "dtolnay/rust-toolchain@3c5f7ea28cd621ae0bf5283f0e981fb97b8a7af9",
      "Swatinem/rust-cache@c19371144df3bb44fab255c43d04cbc2ab54d1c4",
      "tauri-apps/tauri-action@84b9d35b5fc46c1e45415bdb6144030364f7ebc5",
    ];

    expect(releaseUsesValues).toEqual(expectedReleaseActions);
    for (const usesValue of releaseUsesValues) {
      expect(usesValue).toMatch(/@[0-9a-f]{40}$/i);
    }
    expect(releaseWorkflow).not.toContain("actions/upload-artifact");
    expect(releaseWorkflow.match(/secrets\.GITHUB_TOKEN/g)).toHaveLength(4);
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
    expect(extractReleaseCacheBlock(releaseWorkflow)).not.toContain("node_modules");
  });

  it("keeps CI apt mirror failures bounded by an explicit retry policy", () => {
    expect(ciWorkflow.match(/sudo apt-get update -o Acquire::Retries=3/g)).toHaveLength(2);
    expect(
      ciWorkflow.match(
        /sudo apt-get install -y --no-install-recommends -o Acquire::Retries=3 \$\{\{ env\.TAURI_SYSTEM_DEPS \}\}/g,
      ),
    ).toHaveLength(2);
    expect(ciWorkflow).not.toContain("sudo apt-get install -y $" + "{{ env.TAURI_SYSTEM_DEPS }}");
  });

  it("keeps actionlint shellcheck disabled only with a paired shell gate", () => {
    expect(miseToml).toContain('shellcheck = "latest"');
    expect(miseToml).toContain('"lint:actions-shell"');
    expect(extractTaskBlock(miseToml, "lint:actions")).toContain("actionlint -shellcheck=");
    expect(extractTaskBlock(miseToml, "lint:actions-shell")).toContain('run = "actionlint"');
  });

  it("documents the intentionally narrow Windows Rust test scope", () => {
    const rustTestTask = extractTaskBlock(miseToml, "test:rust");

    expect(rustTestTask).toContain("Windows CI is scoped to integration_test");
    expect(rustTestTask).toContain("Linux runs the full Rust suite");
    expect(rustTestTask).toContain('run = "rtk test cargo test --manifest-path src-tauri/Cargo.toml"');
    expect(rustTestTask).toContain(
      'run_windows = "cargo test --manifest-path src-tauri/Cargo.toml --target-dir src-tauri/target/test-rust --test integration_test"',
    );
    const ciTestTask = extractTaskBlock(miseToml, "test:ci");
    expect(ciTestTask).toContain("mise run test:unit:ci\nmise run test:rust");
    expect(ciTestTask).toContain('run_windows = "mise run test:unit:ci && mise run test:rust"');
    expect(ciWorkflow).toContain("mise run test:ci");
    expect(ciWorkflow).not.toMatch(/\brun:\s+cargo test\b/);
  });

  it("keeps Rust cfg(test) production-only release gaps inventoried", () => {
    expect(releaseManualVerification).toContain("Rust Test cfg(test) And Production-Only Coverage Inventory");
    for (const productionOnlySurface of [
      "Tauri runtime startup",
      "Panic and logging",
      "Native updater install",
      "macOS titlebar/focus",
    ]) {
      expect(releaseManualVerification).toContain(productionOnlySurface);
    }
    expect(releaseManualVerification).toContain("Do not treat a `cargo test` pass as evidence for release signing");
    expect(releaseManualVerification).toContain("packaged updater install");
    expect(tauriLib).toContain("#[cfg(not(test))]");
    expect(tauriLib).toContain("fn run()");
    expect(tauriLib).toContain("fn rust_test_cfg_inventory_records_production_only_release_gaps()");
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
    expect(releaseVersionValidator).toContain(`const RELEASE_TAURI_CONFIG_PATH = "${RELEASE_TAURI_CONFIG_PATH}";`);
    expect(releaseVersionValidator).toContain(`const DEV_TAURI_CONFIG_PATH = "${DEV_TAURI_CONFIG_PATH}";`);
    expect(releaseVersionValidator).toContain("src-tauri/tauri.release.conf.json must enable updater artifacts");
    expect(releaseVersionValidator).toContain(
      "release workflow must pass src-tauri/tauri.release.conf.json to tauri-action",
    );
    expect(releaseWorkflow.indexOf("Validate release version parity")).toBeLessThan(
      releaseWorkflow.indexOf("tauri-apps/tauri-action"),
    );
  });

  it("keeps Tauri CSP explicit across release and dev HMR boundaries", () => {
    const csp = tauriConfig.app?.security?.csp ?? "";
    const directives = parseCspDirectives(csp);
    const viteConfig = readText("vite.config.ts");

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
    expect(viteConfig).toContain("port: 1420");
    expect(viteConfig).toContain("port: 1421");
  });

  it("keeps Windows manifest, build script, and generated capability schema in the local release gate", () => {
    const buildScript = readText("src-tauri/build.rs");
    const windowsManifest = readText("src-tauri/windows-test-manifest.xml");
    const defaultCapabilitySource = readText("src-tauri/capabilities/default.json");
    const desktopSchema = JSON.parse(readText("src-tauri/gen/schemas/desktop-schema.json")) as unknown;
    const windowsSchema = JSON.parse(readText("src-tauri/gen/schemas/windows-schema.json")) as unknown;
    const macosSchema = JSON.parse(readText("src-tauri/gen/schemas/macOS-schema.json")) as unknown;
    const aclManifests = JSON.parse(readText("src-tauri/gen/schemas/acl-manifests.json")) as Record<string, unknown>;

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
    expect(desktopSchema).toEqual(windowsSchema);
    expect(desktopSchema).toEqual(macosSchema);
    expect(Object.keys(aclManifests)).toEqual(expect.arrayContaining(["core", "opener", "updater"]));
  });

  it("keeps bundle identifier, release updater artifacts, and updater endpoint in one release contract", () => {
    expect(tauriConfig.identifier).toBe(PROD_TAURI_IDENTIFIER);
    expect(tauriReleaseConfig.identifier).toBe(tauriConfig.identifier);
    expect(tauriConfig.bundle?.createUpdaterArtifacts).toBe(false);
    expect(tauriReleaseConfig.bundle?.createUpdaterArtifacts).toBe(true);
    expect(tauriConfig.plugins?.updater?.endpoints).toEqual([RELEASE_UPDATER_ENDPOINT]);
    expect(tauriConfig.plugins?.updater?.pubkey).toBeTruthy();
    expect(tauriConfig.plugins?.updater?.pubkey).not.toMatch(UPDATER_PUBKEY_PLACEHOLDER_PATTERN);
    expect(releaseVersionValidator).toContain(RELEASE_UPDATER_ENDPOINT);
    expect(releaseVersionValidator).toContain("src-tauri/tauri.conf.json updater pubkey must be configured");
  });

  it("documents the production app data namespace migration path before any bundle identifier change", () => {
    expect(tauriConfig.identifier).toBe(PROD_TAURI_IDENTIFIER);
    expect(tauriReleaseConfig.identifier).toBe(PROD_TAURI_IDENTIFIER);
    expect(tauriDevConfig.identifier).toBe(DEV_TAURI_IDENTIFIER);

    expect(incidentRunbook).toContain("The current production bundle identifier is `com.jey3dayo.ultra-rss-reader`");
    expect(incidentRunbook).toContain("triage must check the old identifier's app data, log, and keyring namespace");
    expect(incidentRunbook).toContain("OS keyring credentials may need to be re-entered");
    expect(incidentRunbook).toContain(
      "Do not move logs, backups, support dumps, or credentials between identifier namespaces",
    );
    expect(incidentRunbook).toContain("normal startup must not rename the app data directory automatically");
    expect(incidentRunbook).toContain("Log paths change with the identifier namespace");
    expect(incidentRunbook).toContain("Rollback across an identifier change must use the old identifier namespace");
    expect(releaseManualVerification).toContain(
      "No automatic app data directory rename is attempted during normal startup",
    );
    expect(releaseManualVerification).toContain("a user-visible database migration prompt or backup/copy prompt");
    expect(releaseManualVerification).toContain("OS keyring credentials cannot be copied automatically");
    expect(releaseManualVerification).toContain(
      "Rollback after an identifier change must return users to the old identifier namespace",
    );
  });

  it("keeps privacy-sensitive export, reset, support dump, and settings portability contracts documented", () => {
    expect(feedContentPrivacy).toContain("### Local Database Encryption At Rest");
    expect(feedContentPrivacy).toContain(
      "Decision: do not add app-managed local database encryption at rest for this release.",
    );
    expect(feedContentPrivacy).toContain(
      "Credentials remain outside the database in the OS keyring for production builds.",
    );
    expect(feedContentPrivacy).toContain("Future work may revisit this decision with a scoped threat model");
    expect(feedContentPrivacy).toContain(
      "Database backups include the SQLite database and any matching `-wal` / `-shm` sidecars.",
    );
    expect(feedContentPrivacy).toContain(
      "Ultra RSS Reader does not encrypt database backups or OPML exports with an app-managed key in this release.",
    );
    expect(feedContentPrivacy).toContain(
      "Users who need encrypted storage or transfer must use OS disk encryption, an encrypted archive, or another external secure channel.",
    );
    expect(incidentRunbook).toContain("Treat database backup sets as private, unencrypted user data.");
    expect(releaseManualVerification).toContain(
      "Database backup/export copy says backups are private and not app-encrypted",
    );
    expect(releaseManualVerification).toContain(
      "recommends preserving a private OS-level copy of the complete app data",
    );
    expect(releaseManualVerification).toContain("directory or database backup set");
    expect(releaseManualVerification).toContain("The user can continue without a backup only when the flow records");
    expect(releaseManualVerification).toContain("that the profile is disposable or already backed up elsewhere.");
    expect(feedContentPrivacy).toContain(
      "Installer upgrade and updater flows that operate on an existing profile must",
    );
    expect(feedContentPrivacy).toContain("recommend a private OS-level copy of the complete app data directory");
    expect(feedContentPrivacy).toContain("describe OPML export or settings export as a complete app-data backup.");

    expect(incidentRunbook).toContain(
      "Uninstall or app binary deletion removes the application bundle only; it must not be described as deleting local app data.",
    );
    expect(incidentRunbook).toContain(
      "Reinstalling the same version or a newer version may reuse the existing app data, database, preferences, logs, and OS keyring credentials.",
    );
    expect(incidentRunbook).toContain(
      "A reset is complete only when all applicable surfaces are removed or intentionally preserved for an active incident.",
    );
    expect(releaseManualVerification).toContain(
      "Reinstalling the same or newer version is allowed to reuse existing app data, preferences, logs, and OS keyring credentials",
    );
    expect(feedContentPrivacy).toContain(
      "Installer, updater, uninstall, and reinstall copy must say that app data can persist across app binary removal and app reinstall.",
    );

    expect(feedContentPrivacy).toContain(
      "any support dump or diagnostics export must require explicit user consent and a redaction preview before the artifact is generated.",
    );
    expect(feedContentPrivacy).toContain("support dump generation must fail closed");
    expect(incidentRunbook).toContain(
      "If a database backup set or support dump is needed, share it only through a private support channel after confirming consent and redaction preview requirements",
    );
    expect(releaseManualVerification).toContain(
      "Support dumps are not generated before explicit user consent and a redaction preview",
    );

    expect(feedContentPrivacy).toContain(
      "do not introduce app settings export/import until the export contract is versioned and excludes secrets by design.",
    );
    expect(feedContentPrivacy).toContain("a top-level schema version and source app identifier");
    expect(feedContentPrivacy).toContain(
      "exclusion of credentials, tokens, cookies, OS keyring references, local filesystem paths, account passwords, and provider session material",
    );
    expect(incidentRunbook).toContain(
      "App settings export/import is not a supported recovery promise until a schema version, source app identifier, secret exclusion list, import conflict behavior, and encryption decision are defined.",
    );
    expect(releaseManualVerification).toContain(
      "App settings export/import is not presented as supported unless the build includes a schema version, source app identifier, strict future-version import behavior, secret exclusion policy, conflict preview, and encryption decision.",
    );
  });

  it("keeps macOS sandbox entitlement changes behind release-native policy", () => {
    expect(releaseManualVerification).toContain("macOS Sandbox Entitlements And Access Policy");
    expect(releaseManualVerification).toContain("does not expand macOS sandbox entitlements opportunistically");
    expect(releaseManualVerification).toContain(
      "Network access is limited to the app's RSS/provider, update, favicon, article media, and Web Preview behavior",
    );
    expect(releaseManualVerification).toContain("File access remains user-initiated or app-owned");
    expect(releaseManualVerification).toContain("Keychain access remains limited to provider credentials");
    expect(releaseManualVerification).toContain(
      "Relevant entitlements output, for example `codesign -d --entitlements :- <app>`.",
    );
  });

  it("keeps reader import, favicon, and browser-origin privacy boundaries documented", () => {
    expect(feedContentPrivacy).toContain(
      "OS file drop and drag-and-drop import surfaces, if added, must enter the same OPML import boundary as the native open dialog.",
    );
    expect(feedContentPrivacy).toContain(
      "Dropped directories, unsupported extensions, multiple-file drops, symlink files, oversized files, and unreadable files must fail or be ignored before parsing",
    );
    expect(feedContentPrivacy).toContain(
      "app shell surfaces must not subscribe to OS file-drop events or expose a shell-wide file-drop overlay",
    );
    expect(feedContentPrivacy).toContain(
      "The browser overlay titlebar drag rail and toolbar actions keep pointer priority through their scoped overlay root",
    );
    expect(feedContentPrivacy).toContain("Favicon requests must send no `Referer` header.");
    expect(feedContentPrivacy).toContain("use a maximum 7-day success TTL");
    expect(feedContentPrivacy).toContain("Failure cache must be bounded, resettable, and expire within 24 hours.");
    expect(feedContentPrivacy).toContain("The embedded browser webview represents a remote publisher origin.");
    expect(feedContentPrivacy).toContain(
      "article reader state may use sanitized `content_sanitized`, local app metadata, and app-controlled focus state",
    );
    expect(feedContentPrivacy).toContain("### Reduced Data And Low Power Policy");
    expect(feedContentPrivacy).toContain("Ultra RSS Reader does not currently integrate with OS reduced-data or");
    expect(feedContentPrivacy).toContain("Reader remote images continue to load in the default mode");
    expect(feedContentPrivacy).toContain("A future reduced-data setting may block reader remote images");
    expect(feedContentPrivacy).toContain("Feed favicon fetching is non-essential remote metadata.");
    expect(feedContentPrivacy).toContain("Automatic background sync may be delayed or skipped while low-power");
    expect(feedContentPrivacy).toContain("Manual sync remains a user override");
    expect(feedContentPrivacy).toContain("Suppressed automatic sync must surface as stale or suppressed state in-app");
    expect(feedContentPrivacy).toContain(
      'Settings copy must describe reduced-data behavior as "limits automatic remote',
    );
    expect(feedContentPrivacy).toContain("### Offline-First Stale Content Banner Policy");
    expect(feedContentPrivacy).toContain("show stale-content warning surfaces only when the reader is presenting");
    expect(feedContentPrivacy).toContain("Account view: show an account-scoped stale warning");
    expect(feedContentPrivacy).toContain("Feed view: show a feed-scoped stale warning");
    expect(feedContentPrivacy).toContain("Article view: show at most a compact inherited stale indicator");
    expect(feedContentPrivacy).toContain("Stale warning dismiss is session-scoped by default");
    expect(feedContentPrivacy).toContain("Account stale dismiss is scoped to the selected account id");
    expect(feedContentPrivacy).toContain("Feed stale dismiss is scoped to the selected feed id");
    expect(feedContentPrivacy).toContain("A new error class, a newer failed manual sync");
    expect(incidentRunbook).toContain(
      "capture whether a stale content banner was shown in the account, feed, or article view",
    );
    expect(readerKeyboardNavigation).toContain("Sync failure, auth failure, or stale content");
    expect(feedContentPrivacy).toContain(
      "Support/debug copy must not include a stable app or environment fingerprint by default.",
    );
    expect(feedContentPrivacy).toContain("### Support/Debug Environment Fingerprint");
    expect(feedContentPrivacy).toContain("must not automatically include hostname, local filesystem paths");
    expect(feedContentPrivacy).toContain("Tooltips and `title` attributes must not reveal credentials");
    expect(feedContentPrivacy).toContain(
      "Feed URLs, server URLs, log paths, and article URLs use redacted display and redacted tooltip copy",
    );
    expect(feedContentPrivacy).toContain("must not appear in logs, support copy, `title` attributes, or error toasts");
    expect(readerKeyboardNavigation).toContain(
      "This exception does not apply to URLs, server paths, credentials, debug paths, or other privacy-sensitive values.",
    );
    expect(readerKeyboardNavigation).toContain("Recovery surfaces must remain keyboard-only operable.");
    expect(readerKeyboardNavigation).toContain(
      "retry, open settings, open log directory, restore backup, dismiss toast, and focus restoration",
    );
    expect(feedContentPrivacy).toContain("Dev mock data source labeling");
    expect(feedContentPrivacy).toContain(
      "Internal Dev mock records, screenshots, and product-metric samples must be labeled as `Dev mock data`",
    );
    expect(feedContentPrivacy).toContain(
      "Release builds must not show the Dev mock data source label because release source must not import dev-only mock data or scenario modules.",
    );

    expect(localProviderSource).toContain("pull_entries_smoke_parses_many_large_entries_under_body_cap");
    expect(opmlCommandsSource).toContain("import_parser_smoke_parses_large_opml_under_file_limit");
    expect(articleContentViewTest).toContain(
      "smoke-renders a large sanitized article body with many remote images without expanding render wrappers",
    );
    expect(feedContentPrivacy).toContain("### Large Feed And Article Memory Pressure Smoke Policy");
    expect(feedContentPrivacy).toContain(
      "Large-feed import and article-render smoke tests are regression sentinels, not supported hard limits.",
    );
    expect(feedContentPrivacy).toContain("Provider parse failures must not persist raw response samples");
    expect(incidentRunbook).toContain("Feed parser failure samples must be support-safe by default.");
    expect(feedContentPrivacy).toContain("### Provider Scale Guidance Decision");
    expect(feedContentPrivacy).toContain(
      "Account settings may show provider-specific feed and article count guidance as advisory performance guidance, not as an enforced maximum.",
    );
    expect(accountCommandsSource).toContain("provider_account_scale_guidance_contract_is_advisory");
    expect(accountCommandsSource).toContain("warning_threshold_guidance");
    expect(accountCommandsSource).toContain("no_hard_limit_copy");
  });

  it("keeps app action diagnostics and public id persistence boundaries documented", () => {
    expect(feedContentPrivacy).toContain("Decision: do not add telemetry for app actions.");
    expect(feedContentPrivacy).toContain(
      "A local-only, redacted, size-capped action sequence may be kept as runtime diagnostics",
    );
    expect(feedContentPrivacy).toContain(
      "Action diagnostics may record action id, surface class, success/failure class, and coarse timing/order.",
    );
    expect(feedContentPrivacy).toContain(
      "Support copy may include the redacted action sequence only after explicit consent and preview",
    );
    expect(feedContentPrivacy).toContain(
      "manually redacted app.log excerpt or reproduction steps rather than adding remote telemetry",
    );

    expect(readerKeyboardNavigation).toContain("## Command And Shortcut Persistence Contract");
    expect(readerKeyboardNavigation).toContain("Shortcut overrides are stored as `shortcut_");
    expect(readerKeyboardNavigation).toContain("{ShortcutActionId}`.");
    expect(readerKeyboardNavigation).toContain(
      'Command palette recent action history stores values created from `{ kind: "action", id }`.',
    );
    expect(readerKeyboardNavigation).toContain("Debug trace strings are diagnostic evidence, not preferences.");
    expect(readerKeyboardNavigation).toContain(
      "Public shortcut/action ids are classified as preference, history, or debug before renaming.",
    );

    expect(incidentRunbook).toContain(
      "When triaging command/action persistence failures, classify the failing surface before recovery",
    );
    expect(incidentRunbook).toContain(
      "`shortcut_*` preference keys require preference migration or quarantine handling",
    );
    expect(incidentRunbook).toContain(
      "command palette recent actions require history cleanup or explicit stale-entry ignore behavior",
    );
    expect(incidentRunbook).toContain(
      "debug input trace strings are evidence for the current build rather than data that should be migrated",
    );
  });

  it("keeps feed provider abuse-prevention and redirect contracts documented", () => {
    expect(providerHttpDefaultsSource).toContain('pub const PROVIDER_USER_AGENT: &str = "UltraRSSReader/0.1";');
    expect(providerHttpDefaultsSource).toContain("pub const PROVIDER_RESPONSE_BODY_CAP_BYTES: u64 = 5 * 1024 * 1024;");
    expect(providerHttpDefaultsSource).toContain("pub const DISCOVERY_RESPONSE_BODY_CAP_BYTES: u64 = 2 * 1024 * 1024;");
    expect(providerHttpDefaultsSource).toContain(".timeout(PROVIDER_HTTP_TIMEOUT)");
    expect(providerHttpDefaultsSource).toContain(".no_proxy()");
    expect(providerHttpDefaultsSource).toContain("PROVIDER_CACHE_CONTROL");
    expect(providerHttpDefaultsSource).toContain("PROVIDER_PRAGMA");

    expect(localProviderSource).toContain("const LOCAL_PROVIDER_SYNC_REQUEST_CONCURRENCY_LIMIT: usize = 1;");
    expect(localProviderSource).toContain("const LOCAL_PROVIDER_DISCOVERY_REQUEST_CONCURRENCY_LIMIT: usize = 1;");
    expect(localProviderSource).toContain("local_provider_limits_concurrent_feed_requests_per_instance");
    expect(localProviderSource).toContain("local_provider_keeps_sync_and_discovery_request_limits_separate");
    expect(localProviderSource).toContain("redirect_policy_preserves_authorization_on_same_origin_redirects");
    expect(localProviderSource).toContain("redirect_policy_strips_authorization_on_cross_origin_redirects");
    expect(localProviderSource).toContain("validate_external_feed_url_rechecks_repeated_private_host_resolution");
    expect(localProviderSource).toContain("pull_entries_preserves_retry_after_for_rate_limit_status");
    expect(localProviderSource).toContain("create_subscription_preserves_retry_after_for_rate_limit_status");

    expect(feedDiscoverySource).toContain("Discovery is a user-initiated single URL probe, not a crawler.");
    expect(feedDiscoverySource).toContain("validate_discovery_redirect_rejects_dns_rebinding_private_hostname_targets");
    expect(feedDiscoverySource).toContain("discovery_http_client_sends_shared_user_agent_and_does_not_prefetch_robots");

    expect(feedContentPrivacy).toContain("Local provider sync is single-flight per provider instance.");
    expect(feedContentPrivacy).toContain(
      "The global local sync cap is 1, which also caps same-host sync concurrency at 1",
    );
    expect(feedContentPrivacy).toContain("Manual sync is allowed to bypass automatic-scheduler suppression");
    expect(feedContentPrivacy).toContain("Feed discovery is a user-initiated single URL probe, not a crawler.");
    expect(feedContentPrivacy).toContain("Authorization headers may remain on same-origin redirects");
    expect(feedContentPrivacy).toContain(
      "Authorization headers must be stripped by the HTTP client on cross-origin redirects.",
    );
    expect(feedContentPrivacy).toContain("Redirect targets are revalidated and re-resolved at every redirect hop");
    expect(feedContentPrivacy).toContain("DNS results are not cached by the app-level policy today.");
    expect(incidentRunbook).toContain("Manual sync can bypass automatic-scheduler suppression");
    expect(incidentRunbook).toContain("Feed discovery is a user-initiated single URL probe, not a crawler");

    expect(providerSource).toContain("provider_auth_semantics_document_token_refresh_contract");
    expect(providerSource).toContain("freshrss_capability_is_connected_to_greader_product_diagnostics");
    expect(providerSource).toContain("unsupported_by_greader_contract");
    expect(providerSource).toContain("freshrss-greader");
    expect(providerSource).toContain("treat_401_403_as_auth_failure_and_scheduler_backoff");
    expect(providerSource).toContain("provider_side_deletion_retention_policy_is_fixed_by_account_kind");
    expect(feedContentPrivacy).toContain("### Provider Sync Contract");
    expect(feedContentPrivacy).toContain(
      "FreshRSS uses the GReader protocol with diagnostics label `freshrss-greader`",
    );
    expect(feedContentPrivacy).toContain("server product version detection is unsupported by the current GReader");
    expect(feedContentPrivacy).toContain("FreshRSS through the GReader API retains local feeds and folders");
    expect(feedContentPrivacy).toContain("HTTP 401 or 403 after reauthentication is an auth failure");
    expect(feedContentPrivacy).toContain(
      "A slow, failed, or retry-delayed account must not block another ready account",
    );
    expect(feedContentPrivacy).toContain("Partial success, all failed, scheduler suppression, and offline");
    expect(incidentRunbook).toContain("### Provider Sync Triage");
    expect(incidentRunbook).toContain("Remote missing feeds or folders are not automatic local deletes for FreshRSS.");
    expect(releaseManualVerification).toContain("expired or rejected tokens surface as auth failure/backoff");
    expect(releaseManualVerification).toContain(
      "Partial sync success remains visible with matching freshness language",
    );
  });

  it("keeps reader search and feed discovery trust contracts synchronized", () => {
    const sqliteArticleSource = readText("src-tauri/src/infra/db/sqlite_article.rs");
    const readerLocaleEn = readText("src/locales/en/reader.json");
    const readerLocaleJa = readText("src/locales/ja/reader.json");

    expect(sqliteArticleSource).toContain("fn build_fts_query(query: &str) -> Option<String>");
    expect(sqliteArticleSource).toContain("Search treats every whitespace-separated token as literal text.");
    expect(sqliteArticleSource).toContain("search_fts_query_builder_quotes_every_term_as_literal_text");
    expect(sqliteArticleSource).toContain("search_dedupes_fts_and_like_hits_before_applying_stable_order");
    expect(sqliteArticleSource).toContain("ORDER BY m.published_at DESC, m.fetched_at DESC, m.article_id DESC");

    expect(readerLocaleEn).toContain(
      "Words are searched literally in titles and article text. Quotes, OR, NEAR, and * are not search operators.",
    );
    expect(readerLocaleJa).toContain(
      "タイトルと本文を単語ごとにそのまま検索します。引用符、OR、NEAR、* は検索演算子として扱いません。",
    );

    expect(feedContentPrivacy).toContain("### Reader Search Query And Snippet Policy");
    expect(feedContentPrivacy).toContain("reader search treats user input as literal words");
    expect(feedContentPrivacy).toContain("remote-content-derived");
    expect(feedContentPrivacy).toContain("snippets");
    expect(feedContentPrivacy).toContain("Search uses SQLite FTS only as a candidate matcher.");
    expect(feedContentPrivacy).toContain("Search UI copy must describe literal-word search");
    expect(feedContentPrivacy).toContain("FTS rank, match position,");
    expect(feedContentPrivacy).toContain("publisher title tricks, or snippet density");
    expect(feedContentPrivacy).toContain("### Article Content Selection And Search Highlight Contract");
    expect(feedContentPrivacy).toContain("stays one contiguous sanitized DOM surface.");
    expect(feedContentPrivacy).toContain("DOM selection inside sanitized article content");
    expect(feedContentPrivacy).toContain("Reader search is a list-level filter only today");
    expect(feedContentPrivacy).toContain("It must not inject search");
    expect(feedContentPrivacy).toContain("highlight markup into sanitized article HTML");
    expect(feedContentPrivacy).toContain("Future article-content virtualization must keep stable scroll anchors");
    expect(feedContentPrivacy).toContain("Image lazy loading may stay browser-owned");

    expect(readerKeyboardNavigation).toContain("## Long Article Selection And Search Highlight Contract");
    expect(readerKeyboardNavigation).toContain("article content remains a single rendered reading surface");
    expect(readerKeyboardNavigation).toContain(
      "Text selection owned by the browser must not be cleared by scroll restoration",
    );
    expect(readerKeyboardNavigation).toContain(
      "Find-in-article and search highlights must be anchored to normalized text ranges or stable content nodes",
    );
    expect(readerKeyboardNavigation).toContain(
      "Reader scroll restoration must use a stable article/content anchor and offset.",
    );

    expect(feedContentPrivacy).toContain("### Feed Discovery Result Trust Levels");
    expect(feedContentPrivacy).toContain(
      "feed discovery results are untrusted metadata until the add action validates and normalizes the selected URL",
    );
    expect(feedContentPrivacy).toContain("Discovery result display | Untrusted preview");
    expect(feedContentPrivacy).toContain("Add action candidate     | Validated candidate");
    expect(feedContentPrivacy).toContain("Stored feed              | Trusted app state");
    expect(feedContentPrivacy).toContain("Add action must use the normalized feed URL selected by validation");
  });

  it("keeps production release log timezone policy synchronized with support docs", () => {
    expect(tauriLib).toContain("TimezoneStrategy::UseLocal");
    expect(tauriLib).toContain('RELEASE_LOG_TIMEZONE_STRATEGY: &str = "UseLocal"');

    for (const doc of [incidentRunbook, releaseManualVerification]) {
      expect(doc).toContain("TimezoneStrategy::UseLocal");
      expect(doc).toContain("OS timezone");
      expect(doc).toContain("UTC offset");
      expect(doc).toContain("DST boundary");
      expect(doc).toContain("release log filenames");
      expect(doc).toContain("log line timestamp");
    }
    expect(releaseManualVerification).toContain("Do not convert local release log timestamps to UTC");
    expect(incidentRunbook).toContain("instead of converting timestamps in place");
  });

  it("keeps packaged window icon paths and runtime platform fallback in the release smoke contract", () => {
    expect(tauriConfig.bundle?.icon).toEqual([...PACKAGED_WINDOW_ICON_PATHS]);
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
    const expectedIconPaths = Object.keys(MOBILE_ICON_ASSET_HASHES).sort();
    const generatedIconPaths = [
      ...readdirSync("src-tauri/icons/android", { recursive: true }).map((entry) => `android/${entry}`),
      ...readdirSync("src-tauri/icons/ios", { recursive: true }).map((entry) => `ios/${entry}`),
    ]
      .filter((entry): entry is string => typeof entry === "string")
      .filter((entry) => /\.(?:png|xml)$/.test(entry))
      .map((entry) => normalizeRepoPath(`icons/${entry}`))
      .sort();

    expect(generatedIconPaths).toEqual(expectedIconPaths);

    for (const [iconPath, expectedHash] of Object.entries(MOBILE_ICON_ASSET_HASHES)) {
      expect(readSha256(`src-tauri/${iconPath}`), iconPath).toBe(expectedHash);
    }

    expect(readText("mise.toml")).toContain('run = "pnpm exec tauri icon"');
    expect(readText("docs/README.md")).toContain("`src-tauri/icons/icon.png` is the checked-in source image");
  });

  it("keeps updater manifest platforms mapped back to release assets and checksums", () => {
    expect(tauriReleaseConfig.bundle?.createUpdaterArtifacts).toBe(true);
    expect(releaseWorkflow).toContain("Validate updater manifest asset contract");
    expect(releaseWorkflow).toContain("Generate updater asset checksums");
    expect(releaseWorkflow).toContain("Upload updater asset checksums");
    expect(releaseWorkflow).toContain("node ./scripts/release/artifacts.ts validate-updater-assets");
    expect(releaseWorkflow).toContain("node ./scripts/release/artifacts.ts generate-updater-checksums");
    expect(releaseWorkflow).toContain("node ./scripts/release/artifacts.ts upload-updater-checksums");
    expect(releaseArtifactsScript).toContain(
      "latest.json updater manifest must map exactly to the release asset contract",
    );

    for (const contract of RELEASE_UPDATER_ASSET_CONTRACT) {
      expect(releaseArtifactsScript).toContain(`platformKey: "${contract.platformKey}"`);
      expect(releaseArtifactsScript).toContain(`artifactPlatform: "${contract.artifactPlatform}"`);
      expect(releaseArtifactsScript).toContain(`artifactArch: "${contract.artifactArch}"`);
      expect(releaseArtifactsScript).toContain(`matrixPlatform: "${contract.matrixPlatform}"`);
      const matrixArgsLiteral = contract.matrixArgs === '""' ? "'\"\"'" : JSON.stringify(contract.matrixArgs);
      expect(releaseArtifactsScript).toContain(`matrixArgs: ${matrixArgsLiteral}`);
      expect(releaseArtifactsScript).toContain(`assetPattern: "${contract.assetPattern}"`);
      expect(releaseArtifactsScript).toContain(`signaturePattern: "${contract.signaturePattern}"`);
      expect(releaseArtifactsScript).toContain(`checksumPattern: "${contract.checksumPattern}"`);
      expect(releaseWorkflow).toContain(`platform: ${contract.matrixPlatform}`);
      expect(releaseWorkflow).toContain(`artifact_platform: ${contract.artifactPlatform}`);
      expect(releaseWorkflow).toContain(`artifact_arch: ${contract.artifactArch}`);
      expect(releaseWorkflow).toContain(`updater_platform: ${contract.platformKey}`);
      expect(releaseWorkflow).toContain(`updater_asset_pattern: ${contract.assetPattern}`);
      expect(releaseWorkflow).toContain(`updater_signature_pattern: ${contract.signaturePattern}`);
      expect(releaseWorkflow).toContain(`args: ${contract.matrixArgs}`);
      expect(contract.signaturePattern).toBe(`${contract.assetPattern}.sig`);
      expect(contract.checksumPattern).toBe(`${contract.assetPattern}.sha256`);
    }

    for (const unsupportedPlatformKey of UNSUPPORTED_UPDATER_PLATFORM_KEYS) {
      expect(releaseArtifactsScript).toContain('UNSUPPORTED_UPDATER_PLATFORM_KEYS = ["linux-x86_64", "linux-aarch64"]');
      expect(releaseArtifactsScript).not.toContain(`platformKey: "${unsupportedPlatformKey}"`);
    }
  });

  it("keeps release artifact provenance evidence tied to tag, workflow, checksum, and SBOM records", () => {
    expect(releaseWorkflow).toContain("Validate release source");
    expect(releaseSourceValidator).toContain("const tagObjectSha = git");
    expect(releaseSourceValidator).toContain("const tagTargetSha = git");
    expect(releaseSourceValidator).toContain("const checkoutSha = git");
    expect(releaseWorkflow).toContain("Generate updater asset checksums");
    expect(releaseWorkflow).toContain("Upload updater asset checksums");
    expect(releaseWorkflow).toContain("Generate release dependency provenance");
    expect(releaseWorkflow).toContain("Generate release provenance record");
    expect(releaseWorkflow).toContain("Upload release provenance assets");
    expect(releaseWorkflow).toContain("mise run report:licenses");
    expect(releaseArtifactsScript).toContain("pnpm-licenses-$" + "{assetPlatform}.json");
    expect(releaseArtifactsScript).toContain("cargo-licenses-$" + "{assetPlatform}.json");
    expect(releaseArtifactsScript).toContain("release-provenance-$" + "{assetPlatform}.json");
    expect(releaseArtifactsScript).toContain("workflowRunUrl");
    expect(releaseArtifactsScript).toContain("tagTargetSha");
    expect(releaseArtifactsScript).toContain('git(["log", "-1", "--format=%s", sourceSha])');
    expect(releaseArtifactsScript).toContain("pullRequestNumber");
    expect(releaseArtifactsScript).toContain("mergeCommitSubject");
    expect(releaseArtifactsScript).toContain('git(["rev-parse", "HEAD"])');
    expect(releaseArtifactsScript).toContain('git(["rev-parse", `refs/tags/$' + "{releaseTag}^{}`])");
    expect(releaseArtifactsScript).toContain("checksumAssetName");
    expect(releaseArtifactsScript).toContain("expected three release provenance assets");
    expect(releaseArtifactsScript).toContain(
      "release provenance source $" + "{sourceSha} does not match tag target $" + "{tagTargetSha}",
    );
    expect(releaseWorkflow).toContain("releaseDraft: $" + "{{ steps.release-policy.outputs.draft }}");
    expect(releaseWorkflow.indexOf("Generate updater asset checksums")).toBeLessThan(
      releaseWorkflow.indexOf("Generate release provenance record"),
    );
    expect(releaseWorkflow.indexOf("Generate release provenance record")).toBeLessThan(
      releaseWorkflow.indexOf("Upload release provenance assets"),
    );
    expect(releaseManualVerification).toContain("Release Provenance And SBOM Record");
    expect(releaseManualVerification).toContain("Annotated tag object SHA");
    expect(releaseManualVerification).toContain("Release tag and tag target SHA");
    expect(releaseManualVerification).toContain("PR number or merge commit subject for the source commit");
    expect(releaseManualVerification).toContain("Source commit SHA checked out by the release workflow");
    expect(releaseManualVerification).toContain("GitHub workflow run id and run URL");
    expect(releaseManualVerification).toContain("Updater checksum sidecar asset");
    expect(releaseManualVerification).toContain("Updater signature sidecar asset");
    expect(releaseManualVerification).toContain("Installed app identifier or bundle identifier");
    expect(releaseManualVerification).toContain("Quarantine and first-launch result");
    expect(releaseManualVerification).toContain("Update check smoke result from the installed published artifact");
    expect(releaseManualVerification).toContain("Windows Installer Signing And SmartScreen Verification");
    expect(releaseManualVerification).toContain("SBOM or dependency provenance record");
    expect(releaseManualVerification).toContain("Draft release attachment list before publishing");
    expect(docsReadme).toContain("Release provenance checklist");
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
    expect(extractReleaseStepBlock(releaseWorkflow, "Run release quality preflight")).toContain(
      "if: steps.signing-preflight.outputs.should_build == 'true'",
    );
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
    expect(releaseManualVerification).toContain("workflow_dispatch` used `dry_run=true`");
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

  it("keeps release notes and updater messages classified from the same user-visible change set", () => {
    expect(releaseManualVerification).toContain(
      "classify the release notes, `CHANGELOG.md`\nentry, and in-app updater message",
    );
    expect(releaseManualVerification).toContain("same user-visible change set");
    expect(releaseManualVerification).toContain("must not\nhide a change that affects update urgency");
    expect(releaseManualVerification).toContain("Security or privacy fix");
    expect(releaseManualVerification).toContain("Data migration or storage compatibility change");
    expect(releaseManualVerification).toContain("Manual action required");
    expect(releaseManualVerification).toContain("Rollback impossible or unsafe");
    expect(releaseManualVerification).toContain("Internal-only maintenance");
  });

  it("keeps public known-issue copy separate from internal TODO risk tracking", () => {
    expect(releaseManualVerification).toContain("Known-issue policy:");
    expect(releaseManualVerification).toContain(
      "User-visible risk, data-loss risk, privacy risk, failed migration risk",
    );
    expect(releaseManualVerification).toContain("Internal-only risk may stay in `TODO.md`");
    expect(releaseManualVerification).toContain("Do not link release\n  notes directly to `TODO.md`");
    expect(releaseManualVerification).toContain(
      "record the\n  internal TODO name in the release handoff or verification notes",
    );
    expect(releaseManualVerification).toContain("A known issue should include a workaround when one exists");
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

    expect(flakyPolicy).toContain("TODO.md");
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

  it("keeps published macOS artifact notarization, quarantine, and translocation manual checks explicit", () => {
    expect(releaseManualVerification).toContain("published macOS artifact downloaded through the normal browser");
    expect(releaseManualVerification).toContain("not a locally rebuilt or re-signed app");
    expect(releaseManualVerification).toContain("com.apple.quarantine");
    expect(releaseManualVerification).toContain(
      "Current release policy assumes no Apple Developer Program / Developer ID",
    );
    expect(releaseManualVerification).toContain('ad-hoc signed with `signingIdentity: "-"`');
    expect(releaseManualVerification).toContain("Gatekeeper and notarization policy result before first launch");
    expect(releaseManualVerification).toContain("does not require removing quarantine manually");
    expect(releaseManualVerification).toContain("translocation evidence");
    expect(releaseManualVerification).toContain("Do not work around it by clearing quarantine on the verifier machine");
  });

  it("keeps release hotfix scope and evidence separate from the normal release checklist", () => {
    expect(releaseManualVerification).toContain("Hotfix Release Checklist");
    expect(releaseManualVerification).toContain("affected version, regression, user impact, and rollback option");
    expect(releaseManualVerification).toContain(
      "contains only the fix, required tests, and release notes for that regression",
    );
    expect(releaseManualVerification).toContain("record the skipped gate and the reason");
    expect(releaseManualVerification).toContain("old artifact digest, replacement artifact digest");
    expect(releaseManualVerification).toContain(
      "Release path: normal, hotfix, rollback/republish, or manual native smoke only",
    );
  });

  it("keeps release builds from using dev Tauri config or dev credentials", () => {
    const tauriActionBlock = extractTauriActionBlock(releaseWorkflow);
    const devOnlyImportPattern = /(?:from\s+|import\()\s*["']@\/dev\/(?:mock-data|scenarios)(?:\/|["'])/;
    const staticDevMocksImportPattern = /^\s*import\s+(?!type\b)[^;\n]+from\s*["']@\/dev\/mocks["']/m;
    const releaseSourceDevOnlyImports = listTypeScriptSourceFiles("src").flatMap((filePath) => {
      if (filePath.startsWith("src/dev/") || filePath.startsWith("src/__tests__/")) {
        return [];
      }
      return devOnlyImportPattern.test(readText(filePath)) ? [filePath] : [];
    });
    const releaseSourceStaticDevMocksImports = listTypeScriptSourceFiles("src").flatMap((filePath) => {
      if (filePath.startsWith("src/dev/") || filePath.startsWith("src/__tests__/")) {
        return [];
      }
      return staticDevMocksImportPattern.test(readText(filePath)) ? [filePath] : [];
    });

    execFileSync("node", ["./scripts/check-release-build-contamination.ts"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    expect(tauriDevConfig.identifier).not.toBe(tauriReleaseConfig.identifier);
    expect(tauriDevConfig.productName).not.toBe(tauriConfig.productName);
    expect(tauriDevConfig.build?.devUrl).toBe("http://127.0.0.1:1420");
    expect(releaseVersionValidator).toContain(
      "src-tauri/tauri.release.conf.json must not use the dev Tauri identifier",
    );
    expect(releaseVersionValidator).toContain(
      "src-tauri/tauri.release.conf.json must not use the dev Tauri product name",
    );
    expect(releaseWorkflow).toContain("Validate release build contamination contract");
    expect(releaseWorkflow).toContain("pnpm run check:release-contamination");
    expect(releaseContaminationChecker).toContain(
      "release capability must not include debug-only MCP bridge permissions",
    );
    expect(releaseContaminationChecker).toContain(
      "release build must keep the MCP bridge plugin behind cfg(debug_assertions)",
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
      /#\[cfg\(debug_assertions\)\]\s*let builder = builder\.plugin\(\s*tauri_plugin_mcp_bridge::Builder::new\(\)/,
    );
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
    expect(releaseSourceDevOnlyImports).toEqual([]);
    expect(releaseSourceStaticDevMocksImports).toEqual([]);
    expect(tauriActionBlock).not.toContain("--config src-tauri/tauri.dev.conf.json");
    expect(releaseWorkflow).not.toMatch(/\bDEV_CREDENTIALS\s*:/);
    expect(releaseWorkflow).not.toMatch(/\bULTRA_RSS_DEV_CREDENTIALS\s*:/);
    expect(releaseManualVerification).toContain("Release Dev-Only Contamination Record");
    expect(releaseManualVerification).toContain("DEV_CREDENTIALS");
    expect(releaseManualVerification).toMatch(/dev mocks/i);
    expect(releaseManualVerification).toContain("debug-only MCP bridge permissions");
  });

  it("keeps release manual checks covering first-run prompts, permission denials, and Windows crash visibility", () => {
    expect(releaseManualVerification).toContain("First-Run Permission Prompt Smoke");
    expect(releaseManualVerification).toContain("First-Run Permission Prompt Verification");
    expect(releaseManualVerification).toContain("first-run prompts appear only after user-initiated actions");
    expect(releaseManualVerification).toContain("denial leaves retryable UI");
    expect(releaseManualVerification).toContain(
      "First account setup reaches native keyring access without falling back to dev credentials",
    );
    expect(releaseManualVerification).toContain(
      "First OPML import or database restore file-open dialog appears as a user-initiated action",
    );
    expect(releaseManualVerification).toContain(
      "First OPML export or database backup save dialog applies the expected extension",
    );
    expect(releaseManualVerification).toContain(
      "First clipboard copy action succeeds or reports permission denial with action-specific recovery copy",
    );

    for (const permissionSurface of [
      "File or folder access",
      "Native open/save dialog access",
      "Keyring access",
      "Clipboard access",
    ]) {
      expect(releaseManualVerification).toContain(permissionSurface);
    }

    expect(releaseManualVerification).toContain("Windows Hidden Console And Crash Visibility Verification");
    expect(releaseManualVerification).toContain("Normal launch does not leave an unexpected console window");
    expect(releaseManualVerification).toContain("release logs without requiring a visible console");
    expect(releaseManualVerification).toContain("user-visible failure surface");
    expect(releaseManualVerification).toContain(
      "support path that does not require the user to run the app from PowerShell",
    );
    expect(releaseManualVerification).toContain(
      "skip that part for the current release and record the missing behavior as release risk",
    );
  });

  it("keeps updater, export, and database backup interruption checks cancellation-aware", () => {
    expect(feedContentPrivacy).toContain("### Import/Export Progress Cancellation");
    expect(feedContentPrivacy).toContain(
      "destructive or ambiguous cancellation confirmation must happen before canceling an import/export operation",
    );
    expect(feedContentPrivacy).toContain(
      "OPML import: confirmation is required after parsing or preview has started and before canceling a running import that may have written feeds or folders.",
    );
    expect(feedContentPrivacy).toContain(
      "OPML export: confirmation is required after the destination path has been chosen and before canceling a running write that may leave a partial artifact.",
    );
    expect(feedContentPrivacy).toContain(
      "Database backup/restore: confirmation is required before canceling any running copy or restore step that may leave a partial backup set or restore target.",
    );
    expect(feedContentPrivacy).toContain(
      "A cancel request made before a file is selected or before an operation starts must close without a confirmation prompt.",
    );
    expect(feedContentPrivacy).toContain(
      "If cancellation cannot guarantee cleanup of a partial artifact, the UI must say the artifact may remain and direct the user to delete or retry it manually.",
    );
    expect(releaseManualVerification).toContain(
      "fresh flow unless the artifact is revalidated against the current manifest",
    );
    expect(releaseManualVerification).toContain(
      "Sleeping during updater download, OPML export, or database backup/restore",
    );
    expect(releaseManualVerification).toContain(
      "either cancels cleanly, blocks restart/retry until cleanup is known, or resumes",
    );
    expect(releaseManualVerification).toContain(
      "Canceling a dialog leaves no file mutation, error toast, or stuck progress state.",
    );
    expect(releaseManualVerification).toContain(
      "After a canceled export or backup, a retry does not silently reuse a stale partial artifact.",
    );
    expect(releaseManualVerification).toContain(
      "Dirty settings forms, pending imports/exports, in-flight backups, and sync writes can block close or restart with clear copy.",
    );
    expect(incidentRunbook).toContain(
      "If OS sleep, app restart, permission denial, or disk full interrupts an updater download, export, or backup, preserve logs and treat any partial artifact as untrusted",
    );
    expect(incidentRunbook).toContain("Canceling an updater download must leave no installable pending artifact.");
    expect(incidentRunbook).toContain(
      "Atomic writes must use a temporary file in the target directory followed by rename for export, database backup/restore, and the dev credential store.",
    );
    expect(updaterCommandsSource).toContain("DownloadGuard");
    expect(updaterCommandsSource).toContain("DownloadProgress");
    expect(updaterCommandsSource).toContain("session_id");
    expect(updaterCommandsSource).toContain("update-ready");
  });

  it("keeps single-instance and deep-link routing behind lifecycle state gates", () => {
    expect(tauriLib).toContain('const MAIN_WINDOW_CLOSE_BLOCKED_EVENT: &str = "main-window-close-blocked";');
    expect(tauriLib).toContain("commands::updater_commands::is_update_download_in_flight()");
    expect(tauriLib).toContain("MainWindowCloseDecision::BlockNativeOperationInFlight");
    expect(tauriLib).toContain("SecondLaunchDecision::FocusAndReportNativeOperationInFlight");

    expect(feedContentPrivacy).toContain("### Single-Instance And Second-Launch Routing");
    expect(feedContentPrivacy).toContain("### System Tray And Background Resident Mode");
    expect(feedContentPrivacy).toContain(
      "do not ship tray or background resident mode until app lifecycle semantics are explicit for close, quit, updater restart, sync, and dirty settings state.",
    );
    expect(feedContentPrivacy).toContain(
      "whether sync scheduler, updater checks, file export, and database backup may run while the main window is hidden",
    );
    expect(feedContentPrivacy).toContain(
      "visible user controls for disabling background activity and for quitting completely",
    );
    expect(feedContentPrivacy).toContain(
      "Until this contract exists, closing the app must not be reinterpreted as background operation",
    );
    expect(feedContentPrivacy).toContain(
      "second launch must be treated as a lifecycle route request, not a blind app restart or state mutation.",
    );
    expect(feedContentPrivacy).toContain(
      "dirty settings, add-feed drafts, pending imports/exports, in-flight backups, sync in-flight, and update pending state remain owned by the first instance",
    );
    expect(feedContentPrivacy).toContain(
      "Until this contract is implemented and verified, second launch must not dispatch app actions beyond focusing the existing window.",
    );
    expect(feedContentPrivacy).toContain(
      "`ultra-rss-reader://v1/<action>` for production and `ultra-rss-reader-dev://v1/<action>` for development",
    );
    expect(feedContentPrivacy).toContain("reserved routes for `focus`, `settings`, and `import-preview`");
    expect(feedContentPrivacy).toContain(
      "queues it behind startup readiness, and applies the action only after sync/update/dirty-state gates allow it",
    );
    expect(feedContentPrivacy).toContain("### Native Notification Permission And Quiet Hours");
    expect(feedContentPrivacy).toContain(
      "do not ship native notifications for sync, update, or error events until permission, privacy, quiet-hours, and disable controls are designed together.",
    );
    expect(feedContentPrivacy).toContain(
      "an explicit user opt-in or OS permission prompt path before the first non-critical notification",
    );
    expect(feedContentPrivacy).toContain(
      "a global disable setting and per-event-class controls before notification delivery",
    );
    expect(feedContentPrivacy).toContain(
      "quiet hours behavior, including whether urgent errors may bypass it and how that exception is presented",
    );
    expect(feedContentPrivacy).toContain(
      "lock-screen-safe copy that redacts account names, feed titles, article titles, server URLs, credentials, tokens, cookies, and local paths",
    );
    expect(feedContentPrivacy).toContain(
      "Until this contract exists, sync/update/error feedback must stay in-app or in redacted logs rather than native OS notifications.",
    );
    expect(feedContentPrivacy).toContain("### Custom Protocol And Deep Link Routing");
    expect(feedContentPrivacy).toContain(
      "do not add a custom protocol or deep links until the URL schema, action allowlist, validation behavior, and single-instance routing are fixed as a contract.",
    );
    expect(feedContentPrivacy).toContain("unknown versions rejected before action mapping");
    expect(feedContentPrivacy).toContain(
      "strict parsing for malformed links, userinfo URLs, mixed scheme casing, percent-encoding, oversized payloads, and repeated parameters",
    );
    expect(feedContentPrivacy).toContain(
      "Until this contract exists, external URLs must continue to use normal OS/browser handling and must not dispatch app actions through a custom protocol.",
    );

    expect(releaseManualVerification).toContain(
      "Second launch with no route focuses or restores the existing main window without starting duplicate sync, updater, import/export, or backup work.",
    );
    expect(releaseManualVerification).toContain(
      "Close-to-tray, full quit, updater restart, OS shutdown, and force quit have separate user-visible behavior.",
    );
    expect(releaseManualVerification).toContain(
      "Background sync, updater checks, file export, and database backup are either disabled while the window is hidden or explicitly documented as resident operations.",
    );
    expect(releaseManualVerification).toContain(
      "Users can disable background activity and can quit the app completely.",
    );
    expect(releaseManualVerification).toContain(
      "Dirty settings, add-feed drafts, sync in-flight, update pending, pending imports/exports, and in-flight backups block or defer routed actions with clear copy.",
    );
    expect(releaseManualVerification).toContain(
      "Custom protocol routes use the reviewed production or development scheme and versioned route shape, reject unknown versions, malformed links, userinfo URLs, oversized payloads, repeated parameters, private hosts, and local paths before mutation, and log only route class plus failure reason.",
    );
    expect(releaseManualVerification).toContain(
      "Single-instance route delivery waits for startup readiness, focuses the main window, and applies only allowlisted actions after sync/update/dirty-state gates allow them.",
    );

    expect(incidentRunbook).toContain(
      "Treat normal second launch as a focus/restore request unless a reviewed single-instance route contract says otherwise.",
    );
    expect(incidentRunbook).toContain(
      "the second launch may restore focus and report the blocked lifecycle route, but it must leave the pending operation owned by the first instance.",
    );
    expect(incidentRunbook).toContain(
      "record only the route class, app scheme, version, validation failure reason, and focus result.",
    );
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
    const providerKinds = extractRustEnumVariants(providerSource, "ProviderKind");
    const enabledServiceKinds = extractEnabledServiceKinds(addAccountServicesSource);

    expect(providerKinds).toEqual(["Local", "FreshRss", "Quarantined"]);
    expect(enabledServiceKinds).toEqual(["Local", "FreshRss"]);
    expect(providerSource).toContain("provider_capability_matrix_is_fixed_by_account_kind");
    expect(providerSource).toContain("supports_read_state_mutations");
    expect(providerSource).toContain("supports_star_state_mutations");
    expect(providerSource).toContain("optimistic_mutation_conflict_policy");
    expect(providerSource).toContain("ProviderSideDeletionRetention::RetainLocal");
    expect(feedContentPrivacy).toContain("### Provider Account Kind Migration Checklist");
    expect(feedContentPrivacy).toContain("Checklist template:");
    expect(feedContentPrivacy).toContain(
      "Account identity: declare the provider kind id, display label, stable account",
    );
    expect(feedContentPrivacy).toContain("Credentials: define where credentials live, how test connection reads them");
    expect(feedContentPrivacy).toContain("Capabilities: document read, star, tag, folder, feed add/delete, article");
    expect(feedContentPrivacy).toContain(
      "Sync cursor: define initial sync, incremental sync, cursor reset, clock skew",
    );
    expect(feedContentPrivacy).toContain(
      "Folder and tag semantics: define ownership, rename/delete behavior, duplicate",
    );
    expect(feedContentPrivacy).toContain(
      "Schema and migration: add or confirm runtime DTO schemas, database migrations",
    );
    expect(feedContentPrivacy).toContain(
      "Privacy boundary: confirm server URLs, feed URLs, article URLs, account names",
    );
    expect(addAccountFormSource).toContain('export type AddAccountProviderKind = "Local" | "FreshRss"');
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
        rust: extractRustEnumVariants(readText("src-tauri/src/commands/dto.rs"), "PlatformKindDto").map(toSnakeCase),
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

    expect(migrationChangelog.map((entry) => entry.fileName)).toEqual([
      "V1__initial.sql",
      "V2__preferences.sql",
      "V3__fts5.sql",
      "V4__tags.sql",
      "V5__feed_display_mode.sql",
      "V6__sync_state_timestamp_usec.sql",
      "V7__feed_display_mode_inherit.sql",
      "V8__feed_reader_preview_modes.sql",
      "V9__reader_preview_default_preferences.sql",
      "V11__account_sync_on_startup.sql",
      "V12__mute_keywords.sql",
      "V13__tag_color_palette_refresh.sql",
      "V14__article_content_text.sql",
      "V15__remove_inoreader.sql",
      "V16__account_connection_verification.sql",
      "V17__article_view_history.sql",
      "V18__db_repository_contracts.sql",
      "V19__article_list_ordered_indexes.sql",
      "V20__article_account_ordered_indexes.sql",
    ]);
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
    expect(readText("src-tauri/src/infra/db/migration.rs")).toContain("fn fresh_db_migrates_to_latest()");
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
    expect(updaterCommandsSource).toContain("clear_pending_update(&mut *pending.0.lock().await)");
    expect(updaterCommandsSource).toContain("pending_update_metadata_matches");
    expect(updaterCommandsSource).toContain("fn pending_update_metadata_contract_rejects_changed_version_or_source()");
    expect(updaterCommandsSource).toContain("Pending update handle changed before install");
    expect(updaterCommandsSource).toContain("update_policy_error(&update)");
    expect(updaterCommandsSource).toContain("Downgrade or same-version update is not allowed");
    expect(updaterCommandsSource).toContain("Unsupported update channel");
    expect(updaterCommandsSource).toContain("Prerelease update is not allowed");

    expect(migrationSource).toContain("pub const LATEST_VERSION");
    expect(migrationSource).toContain("if from_version > LATEST_VERSION");
    expect(migrationSource).toContain("if version > LATEST_VERSION");
    expect(migrationSource).toContain("Downgrade startup is blocked to avoid data loss");
    expect(migrationSource).toContain("fn future_schema_version_blocks_downgrade_migration()");
    expect(incidentRunbook).toContain("Stale update install must be rejected or surfaced as recovery-required");
    expect(incidentRunbook).toContain("Starting an older app against a newer database schema is a downgrade attempt");
    expect(incidentRunbook).toContain(
      "Treat the app binary version, database schema version, and pending updater state as one recovery boundary.",
    );
    expect(incidentRunbook).toContain(
      "After any failed install/restart, record the app binary version, database schema version, and pending update state before retrying.",
    );
    expect(releaseManualVerification).toContain("record app binary version,");
    expect(releaseManualVerification).toContain("database schema version, and pending update state before retrying");
    expect(releaseManualVerification).toContain("stale or partial pending update state is not installable");
    expect(releaseManualVerification).toContain("Rollback impossible or unsafe");
    expect(releaseManualVerification).toContain("Data migration or storage compatibility change");
  });

  it("keeps native menu action payloads aligned with frontend AppAction ids", () => {
    const nativeMenuActions = extractNativeMenuActionContracts(nativeMenuSource);
    const appActions = extractAppActions(appActionsSource);

    expect([...nativeMenuActions.keys()].sort()).toEqual([
      "accounts-add",
      "accounts-show",
      "accounts-sync",
      "check-for-updates",
      "item-browser",
      "item-mark-all-read",
      "item-next",
      "item-prev",
      "item-reader",
      "item-toggle-read",
      "item-toggle-star",
      "settings",
      "share-copy-link",
      "share-open-browser",
      "share-reading-list",
      "subs-add",
      "subs-next",
      "subs-prev",
      "view-all",
      "view-fullscreen",
      "view-group-by-feed",
      "view-sort-unread",
      "view-starred",
      "view-unread",
    ]);
    expect(nativeMenuActions.get("unknown-menu-id")).toBeUndefined();

    for (const [menuId, action] of nativeMenuActions) {
      expect(appActions.has(action), `${menuId} emits ${action}, but APP_ACTIONS does not accept it`).toBe(true);
    }
    expect(appActions.has("unknown-action-payload")).toBe(false);
    expect(appActions.has("disabled-runtime-action")).toBe(false);
    expect(appActionsSource).toContain('export type AppActionSurface = "commandPalette" | "nativeMenu"');
    expect(appActionsSource).toContain("APP_ACTION_CAPABILITY_MATRIX");
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
    expect(keyboardShortcutsSource).toContain(
      'const nativeMenuOwnedShortcuts = new Set(["\\u2318+r", platformSettingsShortcut])',
    );
    expect(nativeMenuActions.get("accounts-sync")).toBe("sync-all");
  });

  it("keeps browser webview capability on a minimal command surface", () => {
    const mainCapability = capabilityByIdentifier(defaultCapability, "main");
    const browserCapability = capabilityByIdentifier(defaultCapability, "browser-webview");
    const browserPermissionIds = browserCapability.permissions?.map(permissionIdentifier) ?? [];

    expect(mainCapability.webviews).toEqual(["main"]);
    expect(browserCapability.webviews).toEqual(["browser-webview"]);
    expect(browserCapability.permissions).toEqual(["core:event:default"]);
    expect(browserCapability.permissions).not.toContain("core:default");
    expect(browserPermissionIds.some((permission) => permission.startsWith("opener:"))).toBe(false);
    expect(browserPermissionIds.some((permission) => permission.startsWith("clipboard-manager:"))).toBe(false);
    expect(browserPermissionIds.some((permission) => permission.startsWith("core:window:"))).toBe(false);
    expect(browserPermissionIds.some((permission) => permission.startsWith("mcp-bridge:"))).toBe(false);
  });

  it("keeps external opener capability scope aligned with the frontend URL schema", () => {
    const mainCapability = capabilityByIdentifier(defaultCapability, "main");
    const openerPermission = mainCapability.permissions?.find(
      (permission) => permissionIdentifier(permission) === "opener:allow-open-url",
    );

    expect(mainCapability.permissions?.map(permissionIdentifier)).not.toContain("opener:allow-default-urls");
    expect(openerPermission).toEqual({
      identifier: "opener:allow-open-url",
      allow: [{ url: "http://*" }, { url: "https://*" }, { url: "mailto:*" }],
    });
  });

  it("keeps native checked menu preferences compatible with frontend preference migration", () => {
    expect(nativeMenuSource).toMatch(
      /fn is_sort_unread_checked\(prefs: &HashMap<String, String>\) -> bool \{\s+prefs\s+\.get\("reading_sort"\)\s+\.or_else\(\|\| prefs\.get\("sort_unread"\)\)\s+\.is_some_and\(\|v\| v == "oldest_first"\)\s+\}/,
    );
    expect(nativeMenuSource).toMatch(
      /fn is_group_by_feed_checked\(prefs: &HashMap<String, String>\) -> bool \{\s+prefs\.get\("group_by"\)\.is_some_and\(\|v\| v == "feed"\)\s+\}/,
    );
    expect(nativeMenuSource).toContain("should_rollback_check_toggle_after_emit(toggled_check_item, true)");
    expect(preferencesStoreSource).toContain(
      'sortUnread: () => resolvePreferenceValue(getState().prefs, "reading_sort")',
    );
    expect(preferencesSchemaSource).toContain('key === "reading_sort"');
    expect(preferencesSchemaSource).toContain('prefs.sort_unread ?? fallbackValue ?? ""');
  });

  it("generates a release/debug feature flag inventory report", () => {
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
    expect(report.inventory.map((item) => item.flag)).toEqual([
      "debug_assertions",
      "VITE_DEV_INTENT",
      "@/dev/scenarios",
      "@/dev/mock-data",
      "src-tauri/tauri.dev.conf.json",
      "DEV_CREDENTIALS",
    ]);
    for (const item of report.inventory) {
      expect(item.evidence.length, item.flag).toBeGreaterThan(0);
      expect(item.debugBehavior, item.flag).not.toBe("");
      expect(item.releaseBehavior, item.flag).not.toBe("");
    }
  });

  it("keeps dependency audit manual until advisory policy is defined", () => {
    expect(miseToml).toContain('[tasks."audit:deps"]');
    expect(miseToml).toContain("Manual dependency security audit");
    expect(ciWorkflow).not.toMatch(/\b(?:pnpm|cargo)\s+audit\b/);
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
    expect(miseToml).toContain('[tasks."quality:markdownlint-contract"]');
    expect(miseToml).toContain("Check markdownlint glob and ignore pattern contract");
    expect(miseToml).toContain("src-tauri/gen/**");
  });

  it("keeps generated fixture, snapshot, and report artifact size budgets under a repo contract", () => {
    const repoFiles = listRepoFiles();
    const fixtureFiles = repoFiles.filter((path) =>
      generatedFixtureSnapshotSizeBudget.fixturePathPrefixes.some((prefix) => path.startsWith(prefix)),
    );
    const snapshotFiles = repoFiles.filter((path) => /(?:^|\/)__snapshots__\/|\.snap(?:\.|$)/.test(path));
    const oversizedFixtureFiles = fixtureFiles.filter(
      (path) => statSync(path).size > generatedFixtureSnapshotSizeBudget.maxCheckedInFixtureBytes,
    );

    expect(fixtureFiles.length).toBeGreaterThan(0);
    expect(oversizedFixtureFiles).toEqual([]);
    expect(snapshotFiles).toHaveLength(generatedFixtureSnapshotSizeBudget.maxSnapshotFileCount);
    expect(
      generatedFixtureSnapshotSizeBudget.generatedReportIgnoredPathPrefixes.every((prefix) =>
        qualityBaselineRepoScanIgnoredPathPrefixes.includes(prefix),
      ),
    ).toBe(true);
    expect(isGeneratedReportArtifactPath("tmp/release-debug-feature-flags.json")).toBe(true);
    expect(isGeneratedReportArtifactPath("tests/fixtures/opml/generated-basic.opml")).toBe(false);
    expect(generatedFixtureSnapshotSizeBudget.largeCorpusDirectoryPrefixes).toEqual(["tests/fixtures/"]);
    expect(generatedFixtureSnapshotSizeBudget.reviewExceptionPolicy).toContain("repo-contract update");
  });

  it("keeps live provider tests opt-in and secret-masked outside the default repo gate", () => {
    const normalizedReleaseManualVerification = releaseManualVerification.replace(/\s+/g, " ");

    expect(miseToml).toContain(`[tasks."${liveProviderTestGateContract.taskName}"]`);
    for (const fragment of liveProviderTestGateContract.commandFragments) {
      expect(miseToml).toContain(fragment);
    }
    expect(miseToml).not.toMatch(new RegExp(`depends = \\[[^\\]]*"${liveProviderTestGateContract.taskName}"`));
    expect(greaderProviderSource).toContain("skip_live_freshrss_test_when_env_is_missing");
    for (const envKey of liveProviderTestGateContract.requiredEnvKeys) {
      expect(greaderProviderSource).toContain(`std::env::var("${envKey}")`);
      expect(releaseManualVerification).toContain(envKey);
    }
    expect(normalizedReleaseManualVerification).toContain(liveProviderTestGateContract.localGateExclusionPolicy);
    expect(normalizedReleaseManualVerification).toContain(liveProviderTestGateContract.maskingPolicy);
  });

  it("keeps test helper global runtime isolation owned at suite boundaries", () => {
    expect(docsReadme).toContain("Test isolation policy");
    expect(docsReadme).toContain(testHelperRuntimeIsolationContract.reviewPolicy);
    expect(testIsolationPolicySource).toContain("test isolation policy contract");

    for (const reset of testHelperRuntimeIsolationContract.suiteBoundaryResets) {
      expect(testSetupSource).toContain(reset);
    }
    for (const surface of testHelperRuntimeIsolationContract.globalRuntimeSurfaces) {
      expect(docsReadme).toContain(surface);
    }
    for (const helperPathPrefix of testHelperRuntimeIsolationContract.helperPathPrefixes) {
      expect(generatedFixtureSnapshotSizeBudget.fixturePathPrefixes).toContain(helperPathPrefix);
    }
  });

  it("documents schema, test fixture, dependency update, and reproducibility gates", () => {
    expect(docsReadme).toContain("Schema and query-cache contracts");
    expect(docsReadme).toContain(
      "Schema parse failure fallbacks must not enable destructive, write, or navigation actions",
    );
    expect(docsReadme).toContain("must include a schema or query-key version segment");
    expect(docsReadme).toContain("Generated schema drift becomes a failing gate");
    expect(docsReadme).toContain("Date fixtures must use a frozen clock plus relative offsets");
    expect(docsReadme).toContain("Reproducibility audit policy");
    expect(docsReadme).toContain("must not depend on local app state");
    expect(docsReadme).toContain("Runtime dependencies affect shipped code or native behavior");
    expect(docsReadme).toContain(
      "Build-only dependencies affect compilation, bundling, packaging, or generated assets",
    );
    expect(docsReadme).toContain("Dev-only dependencies affect lint, format, reports, or local-only tooling");
    expect(docsReadme).toContain("Transitive-risk updates are indirect dependency changes");
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

  it("keeps issue Done When placeholders tied back to the PR DoD checklist", () => {
    const prDodChecks = [
      "動作確認完了",
      "型エラー 0 件",
      "リント違反 0 件",
      "高速テスト成功",
      "フォーマッター適用済み",
    ];

    for (const check of prDodChecks) {
      expect(pullRequestTemplate, `PR DoD missing ${check}`).toContain(check);
    }

    for (const fileName of issueTemplateFileNames) {
      const source = readText(`.github/ISSUE_TEMPLATE/${fileName}`);
      const doneWhenDescription = extractIssueTemplateDoneWhenDescription(source);
      const doneWhenPlaceholder = extractIssueTemplateDoneWhenPlaceholder(source);

      expect(doneWhenDescription, `${fileName} Done When should classify gate differences`).toContain(
        "PR DoD 共通 gate",
      );
      expect(doneWhenDescription, `${fileName} Done When should classify gate differences`).toContain("固有 gate");
      expect(doneWhenDescription, `${fileName} Done When should classify gate differences`).toContain(
        "manual verification gate",
      );
      expect(doneWhenPlaceholder, `${fileName} Done When should reference PR DoD`).toContain(
        "PR 作成時は PR template の確認済み DoD を満たす",
      );
    }
  });
});
