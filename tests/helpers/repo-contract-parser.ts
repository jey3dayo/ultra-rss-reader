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
