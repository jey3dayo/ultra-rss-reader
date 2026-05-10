import { useDeferredValue } from "react";

type SearchPrefix = ">" | "@" | "#" | null;

type CommandSearchResult = {
  prefix: SearchPrefix;
  query: string;
};

const LEADING_FORMAT_CHARACTERS_PATTERN = /^[\u200B-\u200D\uFEFF]+/;
const FULL_WIDTH_SEARCH_PREFIXES = {
  "＞": ">",
  "＠": "@",
  "＃": "#",
} as const satisfies Record<string, Exclude<SearchPrefix, null>>;

function normalizeSearchPrefix(value: string | undefined): Exclude<SearchPrefix, null> | null {
  if (value === ">" || value === "@" || value === "#") {
    return value;
  }

  return value && value in FULL_WIDTH_SEARCH_PREFIXES
    ? FULL_WIDTH_SEARCH_PREFIXES[value as keyof typeof FULL_WIDTH_SEARCH_PREFIXES]
    : null;
}

export function parsePrefix(input: string): CommandSearchResult {
  const trimmedInput = input.trimStart().replace(LEADING_FORMAT_CHARACTERS_PATTERN, "");
  const prefixChar = trimmedInput[0];
  const prefix = normalizeSearchPrefix(prefixChar);

  if (!prefix) {
    return { prefix: null, query: trimmedInput };
  }

  return { prefix, query: trimmedInput.slice(1).trimStart() };
}

export function useCommandSearch(input: string): CommandSearchResult & { deferredQuery: string } {
  const parsed = parsePrefix(input);
  const deferredQuery = useDeferredValue(parsed.query);

  return {
    ...parsed,
    deferredQuery,
  };
}
