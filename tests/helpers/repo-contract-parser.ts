import { expect } from "vitest";

export function expectSortedKeysForTarget(
  target: string,
  actualKeys: Iterable<string>,
  expectedKeys: Iterable<string>,
): void {
  expect([...actualKeys].sort(), `${target} sorted keys`).toEqual([...expectedKeys].sort());
}

export function extractMarkdownSection(source: string, heading: string): string {
  const sectionStart = source.indexOf(`## ${heading}`);
  if (sectionStart === -1) {
    return "";
  }

  const nextSectionStart = source.indexOf("\n## ", sectionStart + 1);
  return source.slice(sectionStart, nextSectionStart === -1 ? undefined : nextSectionStart);
}

export function extractMarkdownCheckboxLabels(source: string, heading: string): string[] {
  return [...extractMarkdownSection(source, heading).matchAll(/^- \[ \] (.+)$/gm)].map((match) => match[1] ?? "");
}

export function extractYamlInlineListValues(source: string, key: string): string[] {
  const value = source.match(new RegExp(`^${key}: \\[(?<values>[^\\]]*)\\]`, "m"))?.groups?.values;
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((item) => item.trim().replace(/^"|"$/g, ""))
    .filter((item) => item.length > 0);
}

export function extractYamlTopLevelKeys(source: string): string[] {
  return [...source.matchAll(/^(?<key>[A-Za-z0-9_/-]+):$/gm)].map((match) => match.groups?.key ?? "");
}

export function extractYamlLabelsFields(source: string): string[] {
  return [...source.matchAll(/^\s+labels: \[(?<labels>[^\]]*)\]/gm)]
    .flatMap((match) => (match.groups?.labels ?? "").split(","))
    .map((label) => label.trim().replace(/^"|"$/g, ""))
    .filter((label) => label.length > 0 && label !== "*");
}

function extractIssueTemplateDoneWhenSection(source: string): string {
  const lines = source.split("\n");
  const sectionStart = lines.findIndex(
    (line, index) => line.trim() === "- type: textarea" && lines[index + 1]?.trim() === "id: done-when",
  );
  if (sectionStart < 0) {
    return "";
  }

  const nextSectionStart = lines.findIndex((line, index) => index > sectionStart && line.startsWith("  - type:"));
  return lines.slice(sectionStart, nextSectionStart < 0 ? undefined : nextSectionStart).join("\n");
}

export function extractIssueTemplateDoneWhenPlaceholder(source: string): string {
  const doneWhenSection = extractIssueTemplateDoneWhenSection(source);
  return doneWhenSection.match(/^\s+placeholder: \|\n(?<placeholder>(?: {8}.+\n?)*)/m)?.groups?.placeholder ?? "";
}

export function extractIssueTemplateDoneWhenDescription(source: string): string {
  const doneWhenSection = extractIssueTemplateDoneWhenSection(source);
  return doneWhenSection.match(/^\s+description: (?<description>.+)$/m)?.groups?.description ?? "";
}
