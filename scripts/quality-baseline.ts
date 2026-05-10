import type { SpawnSyncReturns } from "node:child_process";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const reactDoctorVersion = "0.1.4";
const knipVersion = "6.12.2";
const qualityToolTimeoutMs = 120_000;

export const qualityBaselineRepoScanIgnoredPathPrefixes = [
  "node_modules/",
  "dist/",
  "src-tauri/target/",
  "tmp/",
  "storybook-static/",
  "test-results/",
  "playwright-report/",
  "src-tauri/gen/schemas/",
] as const;

const reactDoctorBaselines = {
  diff: {
    score: 100,
    errorCount: 0,
    warningCount: 0,
    affectedFileCount: 0,
  },
  full: {
    score: 85,
    errorCount: 0,
    warningCount: 228,
    affectedFileCount: 87,
  },
} as const;

const knipBaseline = {
  issueCount: 42,
  findingsCount: 93,
} as const;

type ReactDoctorMode = keyof typeof reactDoctorBaselines;

type ReactDoctorSummary = {
  score: number;
  errorCount: number;
  warningCount: number;
  affectedFileCount: number;
};

type ReactDoctorReport = {
  version: string;
  mode: string;
  summary: ReactDoctorSummary;
};

type KnipIssueBucket = Record<string, unknown>;

type KnipReport = {
  issues: KnipIssueBucket[];
};

export type QualityToolDiagnosticKind =
  | "missing-command"
  | "non-zero-exit"
  | "empty-report"
  | "malformed-report"
  | "process-error"
  | "timeout"
  | "signal";

export type QualityToolDiagnostic = {
  kind: QualityToolDiagnosticKind;
  tool: string;
  command: string;
  message: string;
  exitCode?: number;
  signal?: NodeJS.Signals;
  stderr?: string;
  stdout?: string;
};

export function runQualityBaseline(command: string | undefined = process.argv[2]): void {
  if (command !== "react-doctor:diff" && command !== "react-doctor:full" && command !== "knip") {
    console.error("Usage: node scripts/quality-baseline.ts react-doctor:diff|react-doctor:full|knip");
    process.exit(2);
  }

  if (command === "react-doctor:diff") {
    runReactDoctor("diff", true);
  } else if (command === "react-doctor:full") {
    runReactDoctor("full", false);
  } else {
    runKnip();
  }
}

function runReactDoctor(mode: ReactDoctorMode, failOnDrift: boolean): void {
  const modeFlag = mode === "diff" ? "--diff" : "--full";
  const result = spawnSync(
    "pnpm",
    ["exec", "react-doctor", ".", "--verbose", modeFlag, "--offline", "--json", "--json-compact", "--fail-on", "none"],
    { encoding: "utf8", timeout: qualityToolTimeoutMs },
  );

  const processDiagnostic = createProcessDiagnostic("React Doctor", "pnpm exec react-doctor", result);
  if (processDiagnostic !== null) {
    writeToolDiagnostic(processDiagnostic);
    process.exit(exitCodeForDiagnostic(processDiagnostic));
  }

  const report = parseReactDoctorReportOrExit(result.stdout);
  const expected = reactDoctorBaselines[mode];

  const summary = [
    `React Doctor ${mode}: score=${report.summary.score}`,
    `errors=${report.summary.errorCount}`,
    `warnings=${report.summary.warningCount}`,
    `files=${report.summary.affectedFileCount}`,
  ].join(" ");
  console.log(summary);

  const drift = [
    checkEqual("version", report.version, reactDoctorVersion),
    checkEqual("mode", report.mode, mode),
    checkEqual("score", report.summary.score, expected.score),
    checkEqual("errorCount", report.summary.errorCount, expected.errorCount),
    checkEqual("warningCount", report.summary.warningCount, expected.warningCount),
    checkEqual("affectedFileCount", report.summary.affectedFileCount, expected.affectedFileCount),
  ].filter(Boolean);

  if (drift.length === 0) {
    return;
  }

  console.error(drift.join("\n"));
  if (failOnDrift) {
    process.exit(1);
  }
  console.error("Full scan drift is informational; update the baseline after triage.");
}

function runKnip(): void {
  const actualVersion = readKnipVersion();
  const result = spawnSync("pnpm", ["exec", "knip", "--reporter", "json", "--no-exit-code", "--no-progress"], {
    encoding: "utf8",
    timeout: qualityToolTimeoutMs,
  });

  const processDiagnostic = createProcessDiagnostic("Knip", "pnpm exec knip", result);
  if (processDiagnostic !== null) {
    writeToolDiagnostic(processDiagnostic);
    process.exit(exitCodeForDiagnostic(processDiagnostic));
  }

  const report = parseKnipReportOrExit(result.stdout);
  const findingsCount = report.issues.reduce((total, issue) => total + countIssueFindings(issue), 0);

  console.log(`Knip: issues=${report.issues.length} findings=${findingsCount} version=${actualVersion}`);

  const drift = [
    checkEqual("version", actualVersion, knipVersion),
    checkEqual("issueCount", report.issues.length, knipBaseline.issueCount),
    checkEqual("findingsCount", findingsCount, knipBaseline.findingsCount),
  ].filter(Boolean);

  if (drift.length > 0) {
    console.error(drift.join("\n"));
    process.exit(1);
  }
}

function readKnipVersion(): string {
  const result = spawnSync("pnpm", ["exec", "knip", "--version"], {
    encoding: "utf8",
    timeout: qualityToolTimeoutMs,
  });

  const processDiagnostic = createProcessDiagnostic("Knip", "pnpm exec knip --version", result);
  if (processDiagnostic !== null) {
    writeToolDiagnostic(processDiagnostic);
    process.exit(exitCodeForDiagnostic(processDiagnostic));
  }

  const lines = result.stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const version = lines.find((line) => /^\d+\.\d+\.\d+$/.test(line));
  if (version === undefined) {
    const diagnostic = createReportDiagnostic(
      "Knip",
      "pnpm exec knip --version",
      result.stdout,
      "Could not read Knip version.",
    );
    writeToolDiagnostic(diagnostic);
    process.exit(exitCodeForDiagnostic(diagnostic));
  }
  return version;
}

export function parseReactDoctorReport(stdout: string): ReactDoctorReport {
  for (const payload of readJsonPayloads(stdout)) {
    try {
      const parsed: unknown = JSON.parse(payload);
      return readReactDoctorReport(parsed);
    } catch {}
  }

  throw new Error("React Doctor did not return a valid report JSON object.");
}

function readReactDoctorReport(parsed: unknown): ReactDoctorReport {
  if (!isObject(parsed)) {
    throw new Error("React Doctor did not return a JSON object.");
  }

  const summary = parsed.summary;
  if (!isObject(summary)) {
    throw new Error("React Doctor report is missing summary.");
  }

  return {
    version: readString(parsed, "version"),
    mode: readString(parsed, "mode"),
    summary: {
      score: readNumber(summary, "score"),
      errorCount: readNumber(summary, "errorCount"),
      warningCount: readNumber(summary, "warningCount"),
      affectedFileCount: readNumber(summary, "affectedFileCount"),
    },
  };
}

export function parseKnipReport(stdout: string): KnipReport {
  for (const payload of readJsonPayloads(stdout)) {
    try {
      const parsed: unknown = JSON.parse(payload);
      return readKnipReport(parsed);
    } catch {}
  }

  throw new Error("Knip did not return a valid report JSON object.");
}

function readKnipReport(parsed: unknown): KnipReport {
  if (!isObject(parsed) || !Array.isArray(parsed.issues)) {
    throw new Error("Knip did not return an issues array.");
  }
  return {
    issues: parsed.issues.filter(isObject),
  };
}

export function createProcessDiagnostic(
  tool: string,
  command: string,
  result: SpawnSyncReturns<string>,
): QualityToolDiagnostic | null {
  const stdout = trimOptional(result.stdout);
  const stderr = trimOptional(result.stderr);
  const errorCode = readErrorCode(result.error);

  if (errorCode === "ENOENT") {
    return {
      kind: "missing-command",
      tool,
      command,
      message: `${tool} command could not be started.`,
      stderr,
      stdout,
    };
  }

  if (errorCode === "ETIMEDOUT") {
    return {
      kind: "timeout",
      tool,
      command,
      message: `${tool} command timed out after ${qualityToolTimeoutMs}ms.`,
      signal: result.signal ?? undefined,
      stderr,
      stdout,
    };
  }

  if (result.error !== undefined) {
    return {
      kind: "process-error",
      tool,
      command,
      message: `${tool} command failed before producing a report.`,
      stderr: trimOptional(result.error.message) ?? stderr,
      stdout,
    };
  }

  if (result.signal !== null) {
    return {
      kind: "signal",
      tool,
      command,
      message: `${tool} command was terminated by ${result.signal}.`,
      signal: result.signal,
      stderr,
      stdout,
    };
  }

  if (result.status !== 0) {
    return {
      kind: "non-zero-exit",
      tool,
      command,
      message: `${tool} command exited with status ${result.status ?? "unknown"}.`,
      exitCode: result.status ?? undefined,
      stderr,
      stdout,
    };
  }

  return null;
}

export function createReportDiagnostic(
  tool: string,
  command: string,
  stdout: string,
  error: unknown,
): QualityToolDiagnostic {
  const hasOutput = stdout.trim().length > 0;
  return {
    kind: hasOutput ? "malformed-report" : "empty-report",
    tool,
    command,
    message: hasOutput
      ? `${tool} returned output, but no valid report JSON could be parsed.`
      : `${tool} returned an empty report.`,
    stdout: trimOptional(stdout),
    stderr: error instanceof Error ? error.message : undefined,
  };
}

function countIssueFindings(issue: KnipIssueBucket): number {
  return Object.entries(issue).reduce((total, [key, value]) => {
    if (key === "file" || !Array.isArray(value)) {
      return total;
    }
    return total + value.length;
  }, 0);
}

export function readJsonPayload(stdout: string): string {
  const [payload] = readJsonPayloads(stdout);
  if (payload !== undefined) {
    return payload;
  }

  throw new Error("Tool output did not contain a JSON object.");
}

export function isQualityBaselineRepoScanIgnoredPath(filePath: string): boolean {
  const normalizedPath = normalizeRepoScanPath(filePath);
  return qualityBaselineRepoScanIgnoredPathPrefixes.some((prefix) => normalizedPath.startsWith(prefix));
}

export function partitionQualityBaselineRepoScanPaths(paths: readonly string[]): {
  includedPaths: string[];
  ignoredPaths: string[];
} {
  const includedPaths: string[] = [];
  const ignoredPaths: string[] = [];

  for (const path of paths) {
    if (isQualityBaselineRepoScanIgnoredPath(path)) {
      ignoredPaths.push(path);
    } else {
      includedPaths.push(path);
    }
  }

  return { includedPaths, ignoredPaths };
}

function normalizeRepoScanPath(filePath: string): string {
  return filePath.replaceAll("\\", "/").replace(/^\.\/+/, "");
}

function readJsonPayloads(stdout: string): string[] {
  const payloads: string[] = [];
  for (let start = stdout.indexOf("{"); start !== -1; start = stdout.indexOf("{", start + 1)) {
    const payload = readBalancedJsonObject(stdout, start);
    if (payload === null) {
      continue;
    }

    try {
      JSON.parse(payload);
      payloads.push(payload);
    } catch {}
  }

  return payloads;
}

function readBalancedJsonObject(stdout: string, start: number): string | null {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < stdout.length; index += 1) {
    const char = stdout[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return stdout.slice(start, index + 1);
      }
    }
  }

  return null;
}

function checkEqual(name: string, actual: string | number, expected: string | number): string | null {
  return actual === expected ? null : `${name} drift: expected ${expected}, actual ${actual}`;
}

function parseReactDoctorReportOrExit(stdout: string): ReactDoctorReport {
  try {
    return parseReactDoctorReport(stdout);
  } catch (error) {
    const diagnostic = createReportDiagnostic("React Doctor", "pnpm exec react-doctor", stdout, error);
    writeToolDiagnostic(diagnostic);
    process.exit(exitCodeForDiagnostic(diagnostic));
  }
}

function parseKnipReportOrExit(stdout: string): KnipReport {
  try {
    return parseKnipReport(stdout);
  } catch (error) {
    const diagnostic = createReportDiagnostic("Knip", "pnpm exec knip", stdout, error);
    writeToolDiagnostic(diagnostic);
    process.exit(exitCodeForDiagnostic(diagnostic));
  }
}

function writeToolDiagnostic(diagnostic: QualityToolDiagnostic): void {
  process.stderr.write(`${JSON.stringify(diagnostic)}\n`);
}

function exitCodeForDiagnostic(diagnostic: QualityToolDiagnostic): number {
  if (diagnostic.kind === "missing-command") {
    return 127;
  }
  if (diagnostic.kind === "timeout") {
    return 124;
  }
  return diagnostic.exitCode ?? 1;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readErrorCode(error: Error | undefined): string | undefined {
  if (error === undefined || !hasErrorCode(error) || typeof error.code !== "string") {
    return undefined;
  }
  return error.code;
}

function hasErrorCode(error: Error): error is Error & { code: unknown } {
  return "code" in error;
}

function trimOptional(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed === undefined || trimmed.length === 0 ? undefined : trimmed;
}

function readString(source: Record<string, unknown>, key: string): string {
  const value = source[key];
  if (typeof value !== "string") {
    throw new Error(`Expected string at ${key}.`);
  }
  return value;
}

function readNumber(source: Record<string, unknown>, key: string): number {
  const value = source[key];
  if (typeof value !== "number") {
    throw new Error(`Expected number at ${key}.`);
  }
  return value;
}

const isMainModule = typeof process.argv[1] === "string" && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
  runQualityBaseline();
}
