import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  type CommandResult,
  classifySignatureDiffs,
  compareSnapshots,
  KEYCHAIN_SERVICE,
  type MacosKeychainSignatureSnapshot,
  parseCodesignDetails,
  parseMacosKeychainSignatureSnapshot,
  SNAPSHOT_SCHEMA_VERSION,
  type SnapshotComparison,
  STABLE_COMPARISON_FIELDS,
} from "../lib/macos-signature-diagnostics.ts";

export type MacosSignatureDiagnosticOptions = {
  appPath: string;
  artifactUrl?: string;
  label: string;
  version?: string;
};

export type MacosSignatureDiagnosticsDependencies = {
  platform: string;
  exists: (filePath: string) => boolean;
  runCommand: (command: string, args: string[]) => CommandResult;
  now: () => string;
  readTextFile: (filePath: string) => string;
  writeTextFile: (filePath: string, contents: string) => void;
};

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

const writeTextFile = (filePath: string, text: string): void => {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, text);
};

const productionDependencies: MacosSignatureDiagnosticsDependencies = {
  platform: process.platform,
  exists: existsSync,
  runCommand,
  now: () => new Date().toISOString(),
  readTextFile: (filePath) => readFileSync(filePath, "utf8"),
  writeTextFile,
};

export const recordSnapshot = (
  options: MacosSignatureDiagnosticOptions,
  dependencies: MacosSignatureDiagnosticsDependencies = productionDependencies,
): MacosKeychainSignatureSnapshot => {
  if (dependencies.platform !== "darwin") {
    throw new Error("macOS signature diagnostics must be recorded on macOS");
  }
  if (!dependencies.exists(options.appPath)) {
    throw new Error(`app bundle not found: ${options.appPath}`);
  }

  const infoPath = path.join(options.appPath, "Contents/Info");
  const codesignDisplay = dependencies.runCommand("codesign", ["-dvvv", "-r-", options.appPath]);
  const codesignVerify = dependencies.runCommand("codesign", [
    "--verify",
    "--deep",
    "--strict",
    "--verbose=2",
    options.appPath,
  ]);
  const gatekeeperAssess = dependencies.runCommand("spctl", [
    "--assess",
    "--type",
    "execute",
    "--verbose=4",
    options.appPath,
  ]);
  const bundleIdentifier = dependencies.runCommand("defaults", ["read", infoPath, "CFBundleIdentifier"]);
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
    createdAt: dependencies.now(),
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

export const writeSnapshot = (
  filePath: string,
  snapshot: MacosKeychainSignatureSnapshot,
  dependencies: MacosSignatureDiagnosticsDependencies = productionDependencies,
): void => {
  dependencies.writeTextFile(filePath, `${JSON.stringify(snapshot, null, 2)}\n`);
};

const readSnapshot = (
  filePath: string,
  dependencies: MacosSignatureDiagnosticsDependencies,
): MacosKeychainSignatureSnapshot => {
  const parsed: unknown = JSON.parse(dependencies.readTextFile(filePath));
  return parseMacosKeychainSignatureSnapshot(parsed);
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

type SnapshotFileComparison = {
  after: MacosKeychainSignatureSnapshot;
  before: MacosKeychainSignatureSnapshot;
  comparison: SnapshotComparison;
  report: string;
};

export const compareSnapshotFiles = (
  beforePath: string,
  afterPath: string,
  dependencies: MacosSignatureDiagnosticsDependencies = productionDependencies,
): SnapshotFileComparison => {
  const before = readSnapshot(beforePath, dependencies);
  const after = readSnapshot(afterPath, dependencies);
  const comparison = compareSnapshots(before, after);
  return { after, before, comparison, report: renderComparisonReport(before, after, comparison) };
};

export const writeComparisonReport = (
  filePath: string,
  report: string,
  dependencies: MacosSignatureDiagnosticsDependencies = productionDependencies,
): void => dependencies.writeTextFile(filePath, report);
