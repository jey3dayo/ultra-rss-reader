import { spawnSync } from "node:child_process";

const reactDoctorVersion = "0.1.4";
const knipVersion = "6.12.2";

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

const command = process.argv[2];

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

function runReactDoctor(mode: ReactDoctorMode, failOnDrift: boolean): void {
  const modeFlag = mode === "diff" ? "--diff" : "--full";
  const result = spawnSync(
    "pnpm",
    ["exec", "react-doctor", ".", "--verbose", modeFlag, "--offline", "--json", "--json-compact", "--fail-on", "none"],
    { encoding: "utf8" },
  );

  if (result.status !== 0) {
    process.stderr.write(result.stderr);
    process.stderr.write(result.stdout);
    process.exit(result.status ?? 1);
  }

  const report = parseReactDoctorReport(result.stdout);
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
  });

  if (result.status !== 0) {
    process.stderr.write(result.stderr);
    process.stderr.write(result.stdout);
    process.exit(result.status ?? 1);
  }

  const report = parseKnipReport(result.stdout);
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
  });

  if (result.status !== 0) {
    process.stderr.write(result.stderr);
    process.stderr.write(result.stdout);
    process.exit(result.status ?? 1);
  }

  const lines = result.stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const version = lines.find((line) => /^\d+\.\d+\.\d+$/.test(line));
  if (version === undefined) {
    throw new Error("Could not read Knip version.");
  }
  return version;
}

function parseReactDoctorReport(stdout: string): ReactDoctorReport {
  const parsed: unknown = JSON.parse(readJsonPayload(stdout));
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

function parseKnipReport(stdout: string): KnipReport {
  const parsed: unknown = JSON.parse(readJsonPayload(stdout));
  if (!isObject(parsed) || !Array.isArray(parsed.issues)) {
    throw new Error("Knip did not return an issues array.");
  }

  return {
    issues: parsed.issues.filter(isObject),
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

function readJsonPayload(stdout: string): string {
  const start = stdout.indexOf("{");
  const end = stdout.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("Tool output did not contain a JSON object.");
  }
  return stdout.slice(start, end + 1);
}

function checkEqual(name: string, actual: string | number, expected: string | number): string | null {
  return actual === expected ? null : `${name} drift: expected ${expected}, actual ${actual}`;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
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
