export type ReactDoctorScanDiagnostic = {
  rule: string;
  severity: string;
  normalizedFilePath: string;
  message: string;
};

export type ReactDoctorScanReport = {
  version: string;
  summary: {
    errorCount: number;
    warningCount: number;
    affectedFileCount: number;
  };
  diagnostics: ReactDoctorScanDiagnostic[];
};

// Excludes line/column: rows measurably drift to different lines across plugin versions
// while remaining the same finding, and react-doctor's `id` embeds both plus a content hash.
export type ComplexityFindingIdentity = {
  rule: string;
  normalizedFilePath: string;
  functionName: string;
};

export function complexityIdentityKey(identity: ComplexityFindingIdentity): string {
  return `${identity.rule}::${identity.normalizedFilePath}::${identity.functionName}`;
}

const complexityFunctionNamePattern = /^`([^`]+)`/;

export function extractComplexityFunctionName(message: string): string | null {
  const match = complexityFunctionNamePattern.exec(message);
  return match === null ? null : match[1];
}

export function buildScanComplexityIdentities(
  diagnostics: readonly ReactDoctorScanDiagnostic[],
  classifiedRule: string,
): ComplexityFindingIdentity[] {
  const identities: ComplexityFindingIdentity[] = [];
  for (const diagnostic of diagnostics) {
    if (diagnostic.rule !== classifiedRule) {
      continue;
    }
    const functionName = extractComplexityFunctionName(diagnostic.message);
    if (functionName === null) {
      throw new Error(`Could not extract a function name from a ${classifiedRule} message: ${diagnostic.message}`);
    }
    identities.push({ rule: classifiedRule, normalizedFilePath: diagnostic.normalizedFilePath, functionName });
  }
  return identities;
}

export type ClassificationRecordRow = {
  normalizedFilePath: string;
  functionName: string;
  classificationText: string;
  noLongerReported: boolean;
};

const noLongerReportedMarker = "(no longer reported:";
const recordLocationCellPattern = /^`([^`]+):\d+`$/;
const recordFunctionCellPattern = /^`([^`]+)`$/;

// Splits on unescaped "|" only; the Rationale column uses "\|\|" for literal `||`.
function splitMarkdownTableRow(line: string): string[] {
  const cells = line.split(/(?<!\\)\|/);
  if (cells.length > 0 && cells[0].trim() === "") {
    cells.shift();
  }
  if (cells.length > 0 && cells[cells.length - 1].trim() === "") {
    cells.pop();
  }
  return cells;
}

export function parseComplexityClassificationRecordRows(markdown: string): ClassificationRecordRow[] {
  const rows: ClassificationRecordRow[] = [];
  for (const line of markdown.split("\n")) {
    if (!line.startsWith("|")) {
      continue;
    }
    const cells = splitMarkdownTableRow(line);
    if (cells.length < 6) {
      continue;
    }

    const locationMatch = recordLocationCellPattern.exec(cells[0].trim());
    if (locationMatch === null) {
      continue;
    }
    const functionMatch = recordFunctionCellPattern.exec(cells[1].trim());
    if (functionMatch === null) {
      continue;
    }

    const classificationText = cells[5].trim();
    rows.push({
      normalizedFilePath: locationMatch[1],
      functionName: functionMatch[1],
      classificationText,
      noLongerReported: classificationText.includes(noLongerReportedMarker),
    });
  }
  return rows;
}

export type ComplexityIdentitySetComparison = {
  matchedCount: number;
  recordOnly: ComplexityFindingIdentity[];
  scanOnly: ComplexityFindingIdentity[];
};

export function compareComplexityIdentitySets(
  recordRows: readonly ClassificationRecordRow[],
  scanIdentities: readonly ComplexityFindingIdentity[],
  classifiedRule: string,
): ComplexityIdentitySetComparison {
  const activeRecordIdentities: ComplexityFindingIdentity[] = recordRows
    .filter((row) => !row.noLongerReported)
    .map((row) => ({
      rule: classifiedRule,
      normalizedFilePath: row.normalizedFilePath,
      functionName: row.functionName,
    }));

  const recordByKey = new Map(activeRecordIdentities.map((identity) => [complexityIdentityKey(identity), identity]));
  const scanByKey = new Map(scanIdentities.map((identity) => [complexityIdentityKey(identity), identity]));

  const recordOnly = [...recordByKey.entries()].filter(([key]) => !scanByKey.has(key)).map(([, identity]) => identity);
  const scanOnly = [...scanByKey.entries()].filter(([key]) => !recordByKey.has(key)).map(([, identity]) => identity);
  const matchedCount = [...recordByKey.keys()].filter((key) => scanByKey.has(key)).length;

  return { matchedCount, recordOnly, scanOnly };
}

export type WarningFamilyEntry = { rule: string; count: number };

export function sumWarningFamilyCounts(families: readonly WarningFamilyEntry[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const family of families) {
    totals.set(family.rule, (totals.get(family.rule) ?? 0) + family.count);
  }
  return totals;
}

export function buildWarningRuleCounts(diagnostics: readonly ReactDoctorScanDiagnostic[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const diagnostic of diagnostics) {
    if (diagnostic.severity !== "warning") {
      continue;
    }
    counts.set(diagnostic.rule, (counts.get(diagnostic.rule) ?? 0) + 1);
  }
  return counts;
}

export type WarningFamilyCountMismatch = { rule: string; expected: number; actual: number };

export function findWarningFamilyCountMismatches(
  familyTotals: ReadonlyMap<string, number>,
  warningRuleCounts: ReadonlyMap<string, number>,
): WarningFamilyCountMismatch[] {
  const mismatches: WarningFamilyCountMismatch[] = [];
  for (const [rule, expected] of familyTotals) {
    const actual = warningRuleCounts.get(rule) ?? 0;
    if (actual !== expected) {
      mismatches.push({ rule, expected, actual });
    }
  }
  return mismatches;
}

export function findUnaccountedWarningRules(
  warningRuleCounts: ReadonlyMap<string, number>,
  accountedRuleNames: ReadonlySet<string>,
): string[] {
  return [...warningRuleCounts.keys()].filter((rule) => !accountedRuleNames.has(rule)).sort();
}

export function checkAncestry(scanSha: string, resolvedCommit: string, isAncestor: boolean): string | null {
  if (isAncestor) {
    return null;
  }
  return `scanSha ${scanSha} (${resolvedCommit}) is not an ancestor of origin/main.`;
}

export function checkPluginVersion(reportVersion: string, pinnedVersion: string): string | null {
  if (reportVersion === pinnedVersion) {
    return null;
  }
  return `plugin version drift: scan reports ${reportVersion}, pinned pluginVersion is ${pinnedVersion}.`;
}
