import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const DEFAULT_APP_PATH = "/Applications/Ultra RSS Reader.app";
const KEYCHAIN_SERVICE = "ultra-rss-reader";
const SNAPSHOT_SCHEMA_VERSION = 1;
const STABLE_COMPARISON_FIELDS = [
  "bundleIdentifier",
  "codesignIdentifier",
  "teamIdentifier",
  "authorityChain",
  "designatedRequirement",
] as const;

type StableComparisonField = (typeof STABLE_COMPARISON_FIELDS)[number];

type CommandResult = {
  command: string[];
  ok: boolean;
  status: number | null;
  stderr: string;
  stdout: string;
};

type CodesignDetails = {
  authorityChain: string[];
  cdHash: string | null;
  designatedRequirement: string | null;
  identifier: string | null;
  signature: string | null;
  teamIdentifier: string | null;
};

export type MacosKeychainSignatureSnapshot = {
  appPath: string;
  artifactUrl?: string;
  bundleIdentifier: string | null;
  codesign: CodesignDetails;
  comparisonPolicy: {
    ignoredFields: ["cdHash"];
    requiredStableFields: StableComparisonField[];
  };
  createdAt: string;
  keychainScope: {
    accountIdSource: "Ultra RSS Reader account id";
    service: typeof KEYCHAIN_SERVICE;
  };
  label: string;
  schemaVersion: typeof SNAPSHOT_SCHEMA_VERSION;
  version?: string;
  verification: CommandResult[];
};

type CliOptions = {
  appPath: string;
  artifactUrl?: string;
  before?: string;
  after?: string;
  label: string;
  out?: string;
  version?: string;
};

type SnapshotComparison = {
  diffs: Array<{
    after: string | string[] | null;
    before: string | string[] | null;
    field: StableComparisonField;
  }>;
  ok: boolean;
};

const usage = `Usage:
  pnpm run diagnose:macos-keychain-signature -- record [--app <path>] --label <name> --out <snapshot.json> [--artifact-url <url>] [--version <version>]
  pnpm run diagnose:macos-keychain-signature -- compare --before <old.json> --after <new.json> [--out <report.md>]

Records only signature, bundle identifier, verification status, artifact URL, and keychain service/account-id scope.
It never reads or prints Keychain password values.`;

const normalizeText = (value: string): string => value.trim();

const runCommand = (command: string, args: string[]): CommandResult => {
  const result = spawnSync(command, args, { encoding: "utf8" });

  return {
    command: [command, ...args],
    ok: result.status === 0,
    status: result.status,
    stderr: normalizeText(result.stderr ?? ""),
    stdout: normalizeText(result.stdout ?? ""),
  };
};

const firstMatch = (value: string, pattern: RegExp): string | null => value.match(pattern)?.[1]?.trim() ?? null;

export const parseCodesignDetails = (codesignOutput: string): CodesignDetails => ({
  authorityChain: [...codesignOutput.matchAll(/^Authority=(.+)$/gm)].map((match) => match[1]?.trim() ?? ""),
  cdHash: firstMatch(codesignOutput, /^CDHash=(.+)$/m),
  designatedRequirement: firstMatch(codesignOutput, /^designated => (.+)$/m),
  identifier: firstMatch(codesignOutput, /^Identifier=(.+)$/m),
  signature: firstMatch(codesignOutput, /^Signature=(.+)$/m),
  teamIdentifier: firstMatch(codesignOutput, /^TeamIdentifier=(.+)$/m),
});

const parseArgs = (args: string[]): { command: "compare" | "record"; options: CliOptions } => {
  const normalizedArgs = args[0] === "--" ? args.slice(1) : args;
  const [command, ...rest] = normalizedArgs;
  if (command !== "record" && command !== "compare") {
    throw new Error(usage);
  }

  const options: CliOptions = {
    appPath: DEFAULT_APP_PATH,
    label: command === "record" ? "macos-keychain-signature" : "signature-comparison",
  };

  for (let index = 0; index < rest.length; index += 1) {
    const key = rest[index];
    const value = rest[index + 1];
    if (!key?.startsWith("--") || value === undefined || value.startsWith("--")) {
      throw new Error(`missing value for ${key ?? "(unknown option)"}\n\n${usage}`);
    }

    index += 1;
    switch (key) {
      case "--after":
        options.after = value;
        break;
      case "--app":
        options.appPath = value;
        break;
      case "--artifact-url":
        options.artifactUrl = value;
        break;
      case "--before":
        options.before = value;
        break;
      case "--label":
        options.label = value;
        break;
      case "--out":
        options.out = value;
        break;
      case "--version":
        options.version = value;
        break;
      default:
        throw new Error(`unknown option: ${key}\n\n${usage}`);
    }
  }

  return { command, options };
};

const requireOption = (value: string | undefined, option: string): string => {
  if (!value) {
    throw new Error(`missing required option ${option}\n\n${usage}`);
  }

  return value;
};

const writeTextFile = (filePath: string, text: string): void => {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, text);
};

const commandBlock = (result: CommandResult): string => {
  const output = [result.stdout, result.stderr].filter(Boolean).join("\n");
  return [
    `$ ${result.command.map((part) => (part.includes(" ") ? JSON.stringify(part) : part)).join(" ")}`,
    `status=${result.status ?? "null"} ok=${String(result.ok)}`,
    output,
  ]
    .filter(Boolean)
    .join("\n");
};

export const recordSnapshot = (options: CliOptions): MacosKeychainSignatureSnapshot => {
  if (process.platform !== "darwin") {
    throw new Error("macOS signature diagnostics must be recorded on macOS");
  }
  if (!existsSync(options.appPath)) {
    throw new Error(`app bundle not found: ${options.appPath}`);
  }

  const infoPath = path.join(options.appPath, "Contents/Info");
  const codesignDisplay = runCommand("codesign", ["-dvvv", "-r-", options.appPath]);
  const codesignVerify = runCommand("codesign", ["--verify", "--deep", "--strict", "--verbose=2", options.appPath]);
  const gatekeeperAssess = runCommand("spctl", ["--assess", "--type", "execute", "--verbose=4", options.appPath]);
  const bundleIdentifier = runCommand("defaults", ["read", infoPath, "CFBundleIdentifier"]);
  const codesignRaw = [codesignDisplay.stdout, codesignDisplay.stderr].filter(Boolean).join("\n");

  return {
    appPath: options.appPath,
    artifactUrl: options.artifactUrl,
    bundleIdentifier: bundleIdentifier.ok ? normalizeText(bundleIdentifier.stdout) : null,
    codesign: parseCodesignDetails(codesignRaw),
    comparisonPolicy: {
      ignoredFields: ["cdHash"],
      requiredStableFields: [...STABLE_COMPARISON_FIELDS],
    },
    createdAt: new Date().toISOString(),
    keychainScope: {
      accountIdSource: "Ultra RSS Reader account id",
      service: KEYCHAIN_SERVICE,
    },
    label: options.label,
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    version: options.version,
    verification: [codesignDisplay, codesignVerify, gatekeeperAssess, bundleIdentifier],
  };
};

const readSnapshot = (filePath: string): MacosKeychainSignatureSnapshot =>
  JSON.parse(readFileSync(filePath, "utf8")) as MacosKeychainSignatureSnapshot;

const stableValue = (
  snapshot: MacosKeychainSignatureSnapshot,
  field: StableComparisonField,
): string | string[] | null => {
  switch (field) {
    case "authorityChain":
      return snapshot.codesign.authorityChain;
    case "bundleIdentifier":
      return snapshot.bundleIdentifier;
    case "codesignIdentifier":
      return snapshot.codesign.identifier;
    case "designatedRequirement":
      return snapshot.codesign.designatedRequirement;
    case "teamIdentifier":
      return snapshot.codesign.teamIdentifier;
  }
};

const stableEquals = (left: string | string[] | null, right: string | string[] | null): boolean =>
  Array.isArray(left) || Array.isArray(right)
    ? Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((value, index) => value === right[index])
    : left === right;

export const compareSnapshots = (
  before: MacosKeychainSignatureSnapshot,
  after: MacosKeychainSignatureSnapshot,
): SnapshotComparison => {
  const diffs = STABLE_COMPARISON_FIELDS.flatMap((field) => {
    const beforeValue = stableValue(before, field);
    const afterValue = stableValue(after, field);
    return stableEquals(beforeValue, afterValue) ? [] : [{ after: afterValue, before: beforeValue, field }];
  });

  return { diffs, ok: diffs.length === 0 };
};

const isAdHocSnapshot = (snapshot: MacosKeychainSignatureSnapshot): boolean =>
  snapshot.codesign.signature === "adhoc" ||
  (snapshot.codesign.authorityChain.length === 0 && snapshot.codesign.teamIdentifier === null);

export const classifySignatureDiffs = (
  before: MacosKeychainSignatureSnapshot,
  after: MacosKeychainSignatureSnapshot,
  comparison: SnapshotComparison,
): string[] => {
  if (comparison.ok) {
    return [
      "signature requirement is stable; investigate legacy Keychain ACL or a one-time item re-save if prompts persist",
    ];
  }
  if (isAdHocSnapshot(before) || isAdHocSnapshot(after)) {
    return ["local ad-hoc re-signed app is involved; do not use this Keychain item as published-update evidence"];
  }

  return [
    "release artifact signature requirement changed, or the updater installed a different signed app than the published artifact",
  ];
};

const renderComparisonReport = (
  before: MacosKeychainSignatureSnapshot,
  after: MacosKeychainSignatureSnapshot,
  comparison: SnapshotComparison,
): string => {
  const result = comparison.ok ? "PASS" : "FAIL";
  const diffLines = comparison.diffs.map(
    (diff) => `- ${diff.field}: before=${JSON.stringify(diff.before)} after=${JSON.stringify(diff.after)}`,
  );
  const classificationLines = classifySignatureDiffs(before, after, comparison).map((item) => `- ${item}`);

  return [
    `# macOS Keychain Signature Comparison: ${result}`,
    "",
    `- Before: ${before.label}${before.version ? ` (${before.version})` : ""}`,
    `- After: ${after.label}${after.version ? ` (${after.version})` : ""}`,
    `- Keychain service: ${KEYCHAIN_SERVICE}`,
    "- Keychain account scope: Ultra RSS Reader account id only; password values are not inspected",
    "- Ignored field: cdHash",
    "",
    "## Stable Field Result",
    "",
    comparison.ok ? "- Stable signing fields match" : diffLines.join("\n"),
    "",
    "## Classification",
    "",
    classificationLines.join("\n"),
    "",
    "## Before Commands",
    "",
    ...before.verification.map((result) => ["```text", commandBlock(result), "```", ""].join("\n")),
    "## After Commands",
    "",
    ...after.verification.map((result) => ["```text", commandBlock(result), "```", ""].join("\n")),
  ].join("\n");
};

const runCli = (): void => {
  const { command, options } = parseArgs(process.argv.slice(2));

  if (command === "record") {
    const out = requireOption(options.out, "--out");
    const snapshot = recordSnapshot(options);
    writeTextFile(out, `${JSON.stringify(snapshot, null, 2)}\n`);
    console.log(`wrote macOS Keychain signature snapshot: ${out}`);
    console.log(`keychain scope: service=${KEYCHAIN_SERVICE}, account_id=Ultra RSS Reader account id`);
    return;
  }

  const beforePath = requireOption(options.before, "--before");
  const afterPath = requireOption(options.after, "--after");
  const before = readSnapshot(beforePath);
  const after = readSnapshot(afterPath);
  const comparison = compareSnapshots(before, after);
  const report = renderComparisonReport(before, after, comparison);

  if (options.out) {
    writeTextFile(options.out, report);
    console.log(`wrote macOS Keychain signature comparison: ${options.out}`);
  } else {
    console.log(report);
  }

  if (!comparison.ok) {
    process.exitCode = 1;
  }
};

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  try {
    runCli();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
