import { useDeferredValue } from "react";

type SearchPrefix = ">" | "@" | "#" | null;

type CommandSearchResult = {
  prefix: SearchPrefix;
  query: string;
};

function isSearchPrefix(value: string | undefined): value is Exclude<SearchPrefix, null> {
  return value === ">" || value === "@" || value === "#";
}

export function parsePrefix(input: string): CommandSearchResult {
  const trimmedInput = input.trimStart();
  const prefixChar = trimmedInput[0];
  const prefix = isSearchPrefix(prefixChar) ? prefixChar : null;

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
