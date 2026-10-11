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

export const findTopLevelJsonVersionOwners = (source: string): SourceVersionOwner[] => {
  const owners: SourceVersionOwner[] = [];
  let depth = 0;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (character === '"') {
      const key = readJsonString(source, index);
      if (depth === 1 && key.value === "version") {
        let valueStart = key.end;
        while (/\s/.test(source[valueStart] ?? "")) valueStart += 1;
        if (source[valueStart] !== ":") {
          index = key.end - 1;
          continue;
        }
        valueStart += 1;
        while (/\s/.test(source[valueStart] ?? "")) valueStart += 1;
        if (source[valueStart] !== '"') {
          throw new Error("JSON version owner must be a string");
        }
        const value = readJsonString(source, valueStart);
        owners.push({ end: value.end, start: valueStart, version: value.value });
        index = value.end - 1;
      } else {
        index = key.end - 1;
      }
      continue;
    }
    if (character === "{") depth += 1;
    else if (character === "}") depth -= 1;
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
