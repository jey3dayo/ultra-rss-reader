import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

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
const UPDATER_PUBKEY_PLACEHOLDER_PATTERN = /(?:placeholder|change[_-]?me|todo)/i;
const RELEASE_UPDATER_ASSET_CONTRACT = [
  {
    assetPattern: ".app.tar.gz",
    checksumPattern: ".app.tar.gz.sha256",
    matrixArgs: "--target aarch64-apple-darwin",
    matrixPlatform: "macos-latest",
    platformKey: "darwin-aarch64",
    signaturePattern: ".app.tar.gz.sig",
  },
  {
    assetPattern: "-setup.exe",
    checksumPattern: "-setup.exe.sha256",
    matrixArgs: '""',
    matrixPlatform: "windows-latest",
    platformKey: "windows-x86_64",
    signaturePattern: "-setup.exe.sig",
  },
] as const;
const UNSUPPORTED_UPDATER_PLATFORM_KEYS = ["linux-x86_64", "linux-aarch64"] as const;

const readText = (path: string): string => readFileSync(path, "utf8");

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
    .map((entry) => `${dir}/${entry}`);

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
  const tauriLib = readText("src-tauri/src/lib.rs");
  const devMocks = readText("src/dev/mocks.ts");
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
    expect(releaseWorkflow).toContain("Validate release version parity");
    expect(releaseWorkflow).toContain("release tag $" + "{releaseTag}");
    expect(releaseWorkflow).toContain("src-tauri/tauri.conf.json version");
    expect(releaseWorkflow).toContain("src-tauri/Cargo.toml version");
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
    expect(releaseWorkflow).toContain("ref: >-");
    expect(releaseWorkflow).toContain("format('refs/tags/{0}', inputs.release_tag) || github.ref");
    expect(releaseWorkflow).toContain('if [[ "$EVENT_NAME" == "push" ]]; then');
    expect(releaseWorkflow).toContain('if [[ "$EVENT_NAME" == "workflow_dispatch" ]]; then');
    expect(releaseWorkflow).toContain("tag push ref $WORKFLOW_REF does not match release tag $RELEASE_TAG");
    expect(releaseWorkflow).toContain("manual dispatch ref $WORKFLOW_REF does not match release tag $RELEASE_TAG");
    expect(releaseWorkflow).toContain(
      'git fetch --force --tags origin "refs/tags/$RELEASE_TAG:refs/tags/$RELEASE_TAG"',
    );
    expect(releaseWorkflow).toContain("git fetch --force origin main:refs/remotes/origin/main");
    expect(releaseWorkflow).toContain('tag_target_sha="$(git rev-parse "refs/tags/$RELEASE_TAG^{}")"');
    expect(releaseWorkflow).toContain('checkout_sha="$(git rev-parse HEAD)"');
    expect(releaseWorkflow).toContain('git merge-base --is-ancestor "$tag_target_sha" refs/remotes/origin/main');
    expect(releaseWorkflow).toContain("is not reachable from origin/main");
    expect(releaseWorkflow.indexOf("Validate release source")).toBeLessThan(
      releaseWorkflow.indexOf("Resolve pnpm store path"),
    );
    expect(releaseWorkflow.indexOf("Validate release version parity")).toBeLessThan(
      releaseWorkflow.indexOf("tauri-apps/tauri-action"),
    );
    expect(releaseWorkflow.indexOf("Preflight release build")).toBeLessThan(
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

  it("keeps release dependency cache exact-lockfile only", () => {
    const releaseCacheBlock = extractReleaseCacheBlock(releaseWorkflow);

    expect(releaseCacheBlock).toContain(
      "key: $" + "{{ runner.os }}-pnpm-store-$" + "{{ hashFiles('pnpm-lock.yaml') }}",
    );
    expect(releaseCacheBlock).not.toContain("restore-keys:");
  });

  it("keeps CI pnpm cache restore keys bounded by frozen lockfile installs", () => {
    const ciCacheBlocks = extractCacheBlocks(ciWorkflow);

    expect(ciCacheBlocks.length).toBeGreaterThan(0);
    for (const cacheBlock of ciCacheBlocks) {
      expect(cacheBlock).toContain("key: $" + "{{ runner.os }}-pnpm-store-$" + "{{ hashFiles('pnpm-lock.yaml') }}");
      expect(cacheBlock).toContain("restore-keys:");
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
    expect(readText("scripts/check-workflow-pins.mjs")).toContain('const workflowsDir = ".github/workflows"');
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
      "dtolnay/rust-toolchain@3c5f7ea28cd621ae0bf5283f0e981fb97b8a7af9",
      "Swatinem/rust-cache@c19371144df3bb44fab255c43d04cbc2ab54d1c4",
      "tauri-apps/tauri-action@84b9d35b5fc46c1e45415bdb6144030364f7ebc5",
    ];

    expect(releaseUsesValues).toEqual(expectedReleaseActions);
    for (const usesValue of releaseUsesValues) {
      expect(usesValue).toMatch(/@[0-9a-f]{40}$/i);
    }
    expect(releaseWorkflow).not.toContain("actions/upload-artifact");
    expect(releaseWorkflow.match(/secrets\.GITHUB_TOKEN/g)).toHaveLength(3);
    expect(extractTauriActionBlock(releaseWorkflow)).toContain("GITHUB_TOKEN: $" + "{{ secrets.GITHUB_TOKEN }}");
    expect(extractReleaseStepBlock(releaseWorkflow, "Upload updater asset checksums")).toContain(
      "GH_TOKEN: $" + "{{ secrets.GITHUB_TOKEN }}",
    );
    expect(extractReleaseStepBlock(releaseWorkflow, "Upload release provenance assets")).toContain(
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
    expect(extractTaskBlock(miseToml, "test:ci")).toContain('depends = ["test:rust", "test:unit:ci"]');
    expect(ciWorkflow).toContain("mise run test:ci");
    expect(ciWorkflow).not.toMatch(/\brun:\s+cargo test\b/);
  });

  it("keeps release artifact display metadata source-of-truth explicit", () => {
    expect(packageJson.name).toBe("ultra-rss-reader");
    expect(packageJson.private).toBe(true);
    expect(extractTomlString(cargoToml, "name")).toBe(packageJson.name);
    expect(extractTomlString(cargoToml, "description")).toBe("A Tauri-based RSS reader");
    expect(tauriConfig.productName).toBe("Ultra RSS Reader");
    expect(tauriConfig.identifier).toBe("com.jey3dayo.ultra-rss-reader");
    expect(tauriReleaseConfig.identifier).toBe(tauriConfig.identifier);
    expect(tauriConfig.bundle?.createUpdaterArtifacts).toBe(false);
    expect(tauriReleaseConfig.bundle?.createUpdaterArtifacts).toBe(true);
  });

  it("requires the release workflow to build with the release updater config", () => {
    const tauriActionBlock = extractTauriActionBlock(releaseWorkflow);

    expect(tauriActionBlock).toContain(`--config ${RELEASE_TAURI_CONFIG_PATH}`);
    expect(tauriActionBlock).not.toContain(`--config ${DEV_TAURI_CONFIG_PATH}`);
    expect(tauriActionBlock).not.toContain('--config \'{"identifier"');
    expect(releaseWorkflow).toContain(
      `const tauriReleaseConfig = JSON.parse(fs.readFileSync("${RELEASE_TAURI_CONFIG_PATH}", "utf8"));`,
    );
    expect(releaseWorkflow).toContain(`const releaseConfigPath = "${RELEASE_TAURI_CONFIG_PATH}";`);
    expect(releaseWorkflow).toContain(`const devConfigPath = "${DEV_TAURI_CONFIG_PATH}";`);
    expect(releaseWorkflow).toContain("src-tauri/tauri.release.conf.json must enable updater artifacts");
    expect(releaseWorkflow).toContain("release workflow must pass src-tauri/tauri.release.conf.json to tauri-action");
    expect(releaseWorkflow.indexOf("Validate release version parity")).toBeLessThan(
      releaseWorkflow.indexOf("tauri-apps/tauri-action"),
    );
  });

  it("keeps Tauri CSP http image access explicit for the reader privacy boundary", () => {
    const csp = tauriConfig.app?.security?.csp ?? "";

    expect(csp).toContain("img-src 'self' https: http:");
    expect(csp).not.toContain("upgrade-insecure-requests");
    expect(csp).not.toContain("default-src *");
    expect(csp).not.toContain("img-src *");
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
    expect(tauriConfig.identifier).toBe("com.jey3dayo.ultra-rss-reader");
    expect(tauriReleaseConfig.identifier).toBe(tauriConfig.identifier);
    expect(tauriConfig.bundle?.createUpdaterArtifacts).toBe(false);
    expect(tauriReleaseConfig.bundle?.createUpdaterArtifacts).toBe(true);
    expect(tauriConfig.plugins?.updater?.endpoints).toEqual([RELEASE_UPDATER_ENDPOINT]);
    expect(tauriConfig.plugins?.updater?.pubkey).toBeTruthy();
    expect(tauriConfig.plugins?.updater?.pubkey).not.toMatch(UPDATER_PUBKEY_PLACEHOLDER_PATTERN);
    expect(releaseWorkflow).toContain(RELEASE_UPDATER_ENDPOINT);
    expect(releaseWorkflow).toContain("src-tauri/tauri.conf.json updater pubkey must be configured");
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

  it("keeps updater manifest platforms mapped back to release assets and checksums", () => {
    expect(tauriReleaseConfig.bundle?.createUpdaterArtifacts).toBe(true);
    expect(releaseWorkflow).toContain("Validate updater manifest asset contract");
    expect(releaseWorkflow).toContain("Generate updater asset checksums");
    expect(releaseWorkflow).toContain("Upload updater asset checksums");
    expect(releaseWorkflow).toContain("latest.json updater manifest must map exactly to the release asset contract");

    for (const contract of RELEASE_UPDATER_ASSET_CONTRACT) {
      expect(releaseWorkflow).toContain(`platformKey: "${contract.platformKey}"`);
      expect(releaseWorkflow).toContain(`matrixPlatform: "${contract.matrixPlatform}"`);
      expect(releaseWorkflow).toContain(`matrixArgs: ${JSON.stringify(contract.matrixArgs)}`);
      expect(releaseWorkflow).toContain(`assetPattern: "${contract.assetPattern}"`);
      expect(releaseWorkflow).toContain(`signaturePattern: "${contract.signaturePattern}"`);
      expect(releaseWorkflow).toContain(`checksumPattern: "${contract.checksumPattern}"`);
      expect(releaseWorkflow).toContain(`platform: ${contract.matrixPlatform}`);
      expect(releaseWorkflow).toContain(`args: ${contract.matrixArgs}`);
      expect(contract.signaturePattern).toBe(`${contract.assetPattern}.sig`);
      expect(contract.checksumPattern).toBe(`${contract.assetPattern}.sha256`);
    }

    for (const unsupportedPlatformKey of UNSUPPORTED_UPDATER_PLATFORM_KEYS) {
      expect(releaseWorkflow).toContain(`unsupportedUpdaterPlatformKeys = ["linux-x86_64", "linux-aarch64"]`);
      expect(releaseWorkflow).not.toContain(`platformKey: "${unsupportedPlatformKey}"`);
    }
  });

  it("keeps release artifact provenance evidence tied to tag, workflow, checksum, and SBOM records", () => {
    expect(releaseWorkflow).toContain("Validate release source");
    expect(releaseWorkflow).toContain('tag_target_sha="$(git rev-parse "refs/tags/$RELEASE_TAG^{}")"');
    expect(releaseWorkflow).toContain('checkout_sha="$(git rev-parse HEAD)"');
    expect(releaseWorkflow).toContain("Generate updater asset checksums");
    expect(releaseWorkflow).toContain("Upload updater asset checksums");
    expect(releaseWorkflow).toContain("Generate release dependency provenance");
    expect(releaseWorkflow).toContain("Generate release provenance record");
    expect(releaseWorkflow).toContain("Upload release provenance assets");
    expect(releaseWorkflow).toContain("mise run report:licenses");
    expect(releaseWorkflow).toContain("pnpm-licenses-$" + "{assetPlatform}.json");
    expect(releaseWorkflow).toContain("cargo-licenses-$" + "{assetPlatform}.json");
    expect(releaseWorkflow).toContain("release-provenance-$" + "{assetPlatform}.json");
    expect(releaseWorkflow).toContain("workflowRunUrl");
    expect(releaseWorkflow).toContain("tagTargetSha");
    expect(releaseWorkflow).toContain('execFileSync("git", ["log", "-1", "--format=%s", sourceSha]');
    expect(releaseWorkflow).toContain("pullRequestNumber");
    expect(releaseWorkflow).toContain("mergeCommitSubject");
    expect(releaseWorkflow).toContain('execFileSync("git", ["rev-parse", "HEAD"]');
    expect(releaseWorkflow).toContain(
      'execFileSync("git", ["rev-parse", `refs/tags/$' + "{process.env.RELEASE_TAG}^{}`]",
    );
    expect(releaseWorkflow).toContain("checksumAssetName");
    expect(releaseWorkflow).toContain("expected three release provenance assets");
    expect(releaseWorkflow).toContain(
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

  it("keeps release builds from using dev Tauri config or dev credentials", () => {
    const tauriActionBlock = extractTauriActionBlock(releaseWorkflow);
    const devOnlyImportPattern = /(?:from\s+|import\()\s*["']@\/dev\/(?:mock-data|scenarios)(?:\/|["'])/;
    const releaseSourceDevOnlyImports = listTypeScriptSourceFiles("src").flatMap((filePath) => {
      if (filePath.startsWith("src/dev/") || filePath.startsWith("src/__tests__/")) {
        return [];
      }
      return devOnlyImportPattern.test(readText(filePath)) ? [filePath] : [];
    });

    expect(tauriDevConfig.identifier).not.toBe(tauriReleaseConfig.identifier);
    expect(tauriDevConfig.productName).not.toBe(tauriConfig.productName);
    expect(tauriDevConfig.build?.devUrl).toBe("http://127.0.0.1:1420");
    expect(releaseWorkflow).toContain("src-tauri/tauri.release.conf.json must not use the dev Tauri identifier");
    expect(releaseWorkflow).toContain("src-tauri/tauri.release.conf.json must not use the dev Tauri product name");
    expect(releaseWorkflow).toContain("Validate release build contamination contract");
    expect(releaseWorkflow).toContain("release capability must not include debug-only MCP bridge permissions");
    expect(releaseWorkflow).toContain("release build must keep the MCP bridge plugin behind cfg(debug_assertions)");
    expect(releaseWorkflow).toContain("release build must keep dev browser mocks disabled inside Tauri");
    expect(releaseWorkflow).toContain("release source must not import dev-only mock data or scenario modules");
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
    expect(tauriActionBlock).not.toContain("--config src-tauri/tauri.dev.conf.json");
    expect(releaseWorkflow).not.toMatch(/\bDEV_CREDENTIALS\s*:/);
    expect(releaseWorkflow).not.toMatch(/\bULTRA_RSS_DEV_CREDENTIALS\s*:/);
    expect(releaseManualVerification).toContain("Release Dev-Only Contamination Record");
    expect(releaseManualVerification).toContain("DEV_CREDENTIALS");
    expect(releaseManualVerification).toMatch(/dev mocks/i);
    expect(releaseManualVerification).toContain("debug-only MCP bridge permissions");
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
    expect(addAccountFormSource).toContain('export type AddAccountProviderKind = "Local" | "FreshRss"');
    expect(addAccountFormSource).toContain('case "FreshRss":');
    expect(addAccountFormSource).toContain("requiresCredentials: true");
    expect(addAccountServicesSource).toContain('nameKey: "account.freshrss"');
    expect(addAccountServicesSource).toContain('descKey: "account.freshrss_desc"');
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
    expect(keyboardShortcutsSource).toContain('const nativeMenuOwnedShortcuts = new Set(["\\u2318+r"])');
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
    const prDodChecks = ["動作確認完了", "型エラー 0 件", "リント違反 0 件", "全テスト成功", "フォーマッター適用済み"];

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
