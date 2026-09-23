import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Every accepted-risk / false-positive React Doctor disable carries a
// `<record>.md:<line>` pointer, and `react-doctor-triage.md` forbids an inline
// disable without one. Those line numbers are load-bearing but nothing keeps
// them true: inserting a paragraph into a classification record silently moves
// every heading below it, and the disables then point at prose or at the wrong
// family's section. The two existing records hold 20+ such pointers, so the
// drift is invisible by inspection.
//
// The two records hold their per-finding entries in different shapes, so the
// contract accepts either: a Markdown heading (the warning-classification
// records use one section per family) or a table row (the complexity record is
// one row per finding). A row is checked harder, because it names the file it
// is about: it has to mention the basename of the file whose disable points at
// it, which is what caught this test's own first premise being wrong.
//
// This is a drift guard, not a proof. A pointer that slips a few lines can land
// on a different heading or row and still pass. What it does stop is the common
// failure: inserting prose into a record, moving every entry below it, and
// leaving the disables pointing at body text.

const REPO_ROOT = process.cwd();
const REFERENCE_PATTERN = /(docs\/react-doctor-[a-z0-9-]+\.md):(\d+)/g;

function collectSourceFiles(directory: string): string[] {
  return readdirSync(join(REPO_ROOT, directory), { withFileTypes: true }).flatMap((entry) => {
    const relativePath = `${directory}/${entry.name}`;
    if (entry.isDirectory()) {
      return collectSourceFiles(relativePath);
    }

    return /\.tsx?$/.test(entry.name) ? [relativePath] : [];
  });
}

type Reference = {
  source: string;
  record: string;
  line: number;
};

function collectReferences(): Reference[] {
  return collectSourceFiles("src").flatMap((source) => {
    const contents = readFileSync(join(REPO_ROOT, source), "utf8");

    return [...contents.matchAll(REFERENCE_PATTERN)].map(([, record, line]) => ({
      source,
      record: String(record),
      line: Number(line),
    }));
  });
}

const recordLineCache = new Map<string, string[]>();

function readRecordLines(record: string): string[] {
  const cached = recordLineCache.get(record);
  if (cached) {
    return cached;
  }

  const lines = readFileSync(join(REPO_ROOT, record), "utf8").split("\n");
  recordLineCache.set(record, lines);

  return lines;
}

describe("React Doctor disable record references", () => {
  const references = collectReferences();

  it("finds the references the disable convention requires", () => {
    expect(references.length).toBeGreaterThan(0);
  });

  it.each(references)("$source points at its entry in $record:$line", ({ source, record, line }) => {
    const referenced = readRecordLines(record)[line - 1];

    expect(referenced, `${record}:${line} does not exist`).toBeDefined();
    const entry = referenced ?? "";
    const isHeading = entry.startsWith("#");
    const isTableRow = entry.trimStart().startsWith("|");

    expect(isHeading || isTableRow, `${record}:${line} is neither a heading nor a table row: ${entry}`).toBe(true);

    if (isTableRow) {
      const basename = source.slice(source.lastIndexOf("/") + 1);
      expect(entry, `${record}:${line} is a row about another file`).toContain(basename);
    }
  });
});

const INLINE_DISABLE_PATTERN = /\/\/\s*react-doctor-disable/;

function readTriageRulePaths(): string[] {
  const rule = readFileSync(join(REPO_ROOT, ".claude/rules/react-doctor-triage.md"), "utf8");
  const frontmatter = rule.match(/^---\n([\s\S]*?)\n---\n/)?.[1] ?? "";

  return [...frontmatter.matchAll(/^\s+- "([^"]+)"$/gm)].map(([, path]) => String(path));
}

describe("React Doctor triage rule load scope", () => {
  // The rule is path-scoped, so a file whose inline record points into it must be one of its
  // paths; otherwise editing that file never loads the decision the record depends on.
  it("lists every source file that carries an inline react-doctor-disable record", () => {
    const rulePaths = new Set(readTriageRulePaths());
    const filesWithInlineRecords = collectSourceFiles("src").filter((source) =>
      INLINE_DISABLE_PATTERN.test(readFileSync(join(REPO_ROOT, source), "utf8")),
    );

    expect(filesWithInlineRecords.length).toBeGreaterThan(0);
    expect(filesWithInlineRecords.filter((source) => !rulePaths.has(source))).toEqual([]);
  });
});
