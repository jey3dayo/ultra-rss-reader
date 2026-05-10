import { expect } from "vitest";

export function expectSortedKeysForTarget(
  target: string,
  actualKeys: Iterable<string>,
  expectedKeys: Iterable<string>,
): void {
  expect([...actualKeys].toSorted(), `${target} sorted keys`).toEqual([...expectedKeys].toSorted());
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

export function extractMarkdownInlineCode(source: string): string[] {
  return [...source.matchAll(/`([^`]+)`/g)].map((match) => match[1] ?? "");
}

export function extractMarkdownLinks(source: string): string[] {
  return [...source.matchAll(/(?<!!)\[[^\]]+\]\(([^)]+)\)/g)].map((match) => match[1] ?? "");
}

export function extractMarkdownRelativeLinks(source: string): string[] {
  return extractMarkdownLinks(source)
    .map((link) => link.match(/^(\.\/[^)#]+)(?:#[^)]+)?$/)?.[1] ?? "")
    .filter((link) => link.length > 0);
}

function stripYamlComment(value: string): string {
  let quote: "'" | '"' | null = null;

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    const previousChar = value[index - 1];

    if ((char === "'" || char === '"') && (quote === null || quote === char) && previousChar !== "\\") {
      quote = quote === char ? null : char;
      continue;
    }

    if (char === "#" && quote === null) {
      return value.slice(0, index).trimEnd();
    }
  }

  return value.trimEnd();
}

function unquoteYamlScalar(value: string): string {
  const trimmedValue = value.trim();
  const firstChar = trimmedValue[0];
  const lastChar = trimmedValue.at(-1);

  if ((firstChar === '"' || firstChar === "'") && firstChar === lastChar) {
    return trimmedValue.slice(1, -1);
  }

  return trimmedValue;
}

function splitYamlInlineListValues(value: string): string[] {
  const values: string[] = [];
  let quote: "'" | '"' | null = null;
  let currentValue = "";

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index] ?? "";
    const previousChar = value[index - 1];

    if ((char === "'" || char === '"') && (quote === null || quote === char) && previousChar !== "\\") {
      quote = quote === char ? null : char;
      currentValue += char;
      continue;
    }

    if (char === "," && quote === null) {
      values.push(currentValue);
      currentValue = "";
      continue;
    }

    currentValue += char;
  }

  values.push(currentValue);

  return values.map((item) => unquoteYamlScalar(item)).filter((item) => item.length > 0);
}

function extractYamlBlockListValues(source: string, key: string): string[] {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const blockList = source.match(new RegExp(`^${escapedKey}:\\s*\\n(?<items>(?:\\s+- .+\\n?)*)`, "m"))?.groups?.items;

  if (!blockList) {
    return [];
  }

  return [...blockList.matchAll(/^\s+- (?<item>.+)$/gm)]
    .map((match) => unquoteYamlScalar(stripYamlComment(match.groups?.item ?? "")))
    .filter((item) => item.length > 0);
}

export function extractYamlInlineListValues(source: string, key: string): string[] {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const value = source.match(new RegExp(`^${escapedKey}:\\s*\\[(?<values>.*)\\]\\s*(?:#.*)?$`, "m"))?.groups?.values;
  if (!value) {
    return extractYamlBlockListValues(source, key);
  }

  return splitYamlInlineListValues(stripYamlComment(value));
}

export function extractYamlTopLevelKeys(source: string): string[] {
  return [...source.matchAll(/^(?<key>[A-Za-z0-9_/-]+):$/gm)].map((match) => match.groups?.key ?? "");
}

export function extractYamlLabelsFields(source: string): string[] {
  return [...source.matchAll(/^\s+labels:\s*\[(?<labels>.*)\]\s*(?:#.*)?$/gm)]
    .flatMap((match) => splitYamlInlineListValues(stripYamlComment(match.groups?.labels ?? "")))
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
