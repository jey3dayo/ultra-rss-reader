export type SourceVersionOwner = {
  end: number;
  start: number;
  version: string;
};

export type CargoLockPackageVersionOwners = {
  nameCount: number;
  versions: SourceVersionOwner[];
};

export type MsixIdentityVersionOwners = {
  versions: SourceVersionOwner[];
};

export const STABLE_VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
export const MSIX_VERSION_COMPONENT_MAX = 65_535;

const CARGO_LOCK_PACKAGE_SECTION_PATTERN = /^\[\[package\]\]\s*$/gm;
const CARGO_LOCK_NAME_PATTERN = /^name\s*=\s*"([^"]+)"\s*$/gm;
const CARGO_LOCK_VERSION_PATTERN = /^version\s*=\s*"([^"]+)"\s*$/gm;
const MSIX_IDENTITY_PATTERN = /<Identity\b[^>]*\/>/g;
const MSIX_IDENTITY_VERSION_PATTERN = /\bVersion="([^"]+)"/g;

const readJsonString = (source: string, start: number): { end: number; value: string } => {
  for (let index = start + 1; index < source.length; index += 1) {
    const character = source[index];
    if (character === "\\") {
      index += 1;
      continue;
    }
    if (character === '"') {
      const parsed: unknown = JSON.parse(source.slice(start, index + 1));
      if (typeof parsed !== "string") {
        throw new Error("JSON string token is not a string");
      }
      return { end: index + 1, value: parsed };
    }
  }
  throw new Error("unterminated JSON string");
};

const skipJsonWhitespace = (source: string, start: number): number => {
  let index = start;
  while (/\s/.test(source[index] ?? "")) index += 1;
  return index;
};

// key の直後を読み、`:` が無ければ null（key として扱わない）、値が文字列でなければ throw する
const readVersionValue = (source: string, keyEnd: number): SourceVersionOwner | null => {
  const colon = skipJsonWhitespace(source, keyEnd);
  if (source[colon] !== ":") return null;
  const valueStart = skipJsonWhitespace(source, colon + 1);
  if (source[valueStart] !== '"') {
    throw new Error("JSON version owner must be a string");
  }
  const value = readJsonString(source, valueStart);
  return { end: value.end, start: valueStart, version: value.value };
};

const depthDelta = (character: string | undefined): number => {
  if (character === "{") return 1;
  if (character === "}") return -1;
  return 0;
};

export const findTopLevelJsonVersionOwners = (source: string): SourceVersionOwner[] => {
  const owners: SourceVersionOwner[] = [];
  let depth = 0;

  for (let index = 0; index < source.length; index += 1) {
    if (source[index] !== '"') {
      depth += depthDelta(source[index]);
      continue;
    }
    const key = readJsonString(source, index);
    const owner = depth === 1 && key.value === "version" ? readVersionValue(source, key.end) : null;
    if (owner) owners.push(owner);
    index = (owner?.end ?? key.end) - 1;
  }

  return owners;
};

export const findCargoLockPackageVersionOwners = (source: string): CargoLockPackageVersionOwners[] => {
  const sections = [...source.matchAll(CARGO_LOCK_PACKAGE_SECTION_PATTERN)];
  return sections.flatMap((section, index) => {
    const sectionStart = (section.index ?? 0) + section[0].length;
    const sectionEnd = sections[index + 1]?.index ?? source.length;
    const packageSection = source.slice(sectionStart, sectionEnd);
    const names = [...packageSection.matchAll(CARGO_LOCK_NAME_PATTERN)];
    if (!names.some((name) => name[1] === "ultra-rss-reader")) return [];

    const versions = [...packageSection.matchAll(CARGO_LOCK_VERSION_PATTERN)].map((match) => {
      const version = match[1] ?? "";
      const versionStart = sectionStart + (match.index ?? 0) + match[0].indexOf('"') + 1;
      return { end: versionStart + version.length, start: versionStart, version };
    });
    return [{ nameCount: names.length, versions }];
  });
};

export const findMsixIdentityVersionOwners = (source: string): MsixIdentityVersionOwners[] =>
  [...source.matchAll(MSIX_IDENTITY_PATTERN)].map((identity) => {
    const identityStart = identity.index ?? 0;
    const element = identity[0];
    const versions = [...element.matchAll(MSIX_IDENTITY_VERSION_PATTERN)].map((match) => {
      const version = match[1] ?? "";
      const versionStart = identityStart + (match.index ?? 0) + match[0].indexOf('"') + 1;
      return { end: versionStart + version.length, start: versionStart, version };
    });
    return { versions };
  });
