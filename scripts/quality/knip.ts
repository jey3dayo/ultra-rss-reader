import { spawnSync } from "node:child_process";
import {
  createProcessDiagnostic,
  createReportDiagnostic,
  exitCodeForDiagnostic,
  qualityToolTimeoutMs,
  writeToolDiagnostic,
} from "./tool-process.ts";

const knipBaseline = {
  issueCount: 3,
  findingsCount: 3,
} as const;

export type KnipIssueBucket = Record<string, unknown>;

export type KnipReport = {
  issues: KnipIssueBucket[];
};

export function runKnip(gate: boolean): void {
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
  for (const issue of report.issues) {
    console.log(`Knip issue: ${formatKnipIssue(issue)}`);
  }

  const drift = [
    checkEqual("issueCount", report.issues.length, knipBaseline.issueCount),
    checkEqual("findingsCount", findingsCount, knipBaseline.findingsCount),
  ].filter(Boolean);

  if (drift.length > 0) {
    const label = gate ? "Knip baseline delta:" : "Knip baseline delta (informational):";
    console.log([label, ...drift].join("\n"));
  }

  if (gate && (report.issues.length > knipBaseline.issueCount || findingsCount > knipBaseline.findingsCount)) {
    console.error(
      `Knip findings exceed baseline (issues ${report.issues.length}/${knipBaseline.issueCount}, findings ${findingsCount}/${knipBaseline.findingsCount}). Remove the unused code or update knipBaseline with a classification in docs/knip-export-classification.md.`,
    );
    process.exit(1);
  }
}

export function formatKnipIssue(issue: KnipIssueBucket): string {
  const file = typeof issue.file === "string" ? issue.file : "<unknown file>";
  const categories = Object.entries(issue).flatMap(([key, value]) => {
    if (key === "file" || !Array.isArray(value) || value.length === 0) {
      return [];
    }
    const entries: unknown[] = value;
    const names = entries.reduce<string[]>((names, entry) => {
      let name: string | undefined;
      if (typeof entry === "string") {
        name = entry;
      } else if (entry && typeof entry === "object" && "name" in entry && typeof entry.name === "string") {
        name = entry.name;
      }
      // Knip reports an unused file with its own path as the entry name, which
      // would repeat the line prefix. Drop names that add nothing to the line.
      if (name !== undefined && name !== file) {
        names.push(name);
      }
      return names;
    }, []);
    return [names.length > 0 ? `${key}: ${names.join(", ")}` : key];
  });

  return categories.length > 0 ? `${file} ${categories.join(" ")}` : file;
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

export function parseKnipReport(stdout: string): KnipReport {
  // Knip with --reporter json writes a single JSON line. Parse the last non-empty line.
  const lines = stdout
    .trim()
    .split("\n")
    .filter((line) => line.trim());
  const lastLine = lines[lines.length - 1];
  if (!lastLine) {
    throw new Error("Knip did not return any output.");
  }

  try {
    const parsed: unknown = JSON.parse(lastLine);
    if (typeof parsed !== "object" || parsed === null || !Array.isArray((parsed as Record<string, unknown>).issues)) {
      throw new Error("Knip did not return an issues array.");
    }
    return {
      issues: ((parsed as Record<string, unknown>).issues as unknown[]).filter(
        (item): item is Record<string, unknown> => typeof item === "object" && item !== null && !Array.isArray(item),
      ),
    };
  } catch (error) {
    throw new Error(
      `Knip did not return a valid report JSON object: ${error instanceof Error ? error.message : "parse failed"}`,
    );
  }
}

function countIssueFindings(issue: KnipIssueBucket): number {
  return Object.entries(issue).reduce((total, [key, value]) => {
    if (key === "file" || !Array.isArray(value)) {
      return total;
    }
    return total + value.length;
  }, 0);
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

function checkEqual(name: string, actual: string | number | null, expected: string | number | null): string | null {
  return actual === expected ? null : `${name} drift: expected ${expected}, actual ${actual}`;
}
