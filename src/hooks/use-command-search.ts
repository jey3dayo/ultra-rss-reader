import { useDeferredValue } from "react";

export type SearchPrefix = ">" | "@" | "#" | null;

export type CommandSearchResult = {
  prefix: SearchPrefix;
  query: string;
};

const PREFIXES: SearchPrefix[] = [">", "@", "#"];

export function parsePrefix(input: string): CommandSearchResult {
  const trimmedInput = input.trimStart();
  const prefixChar = trimmedInput[0] as Exclude<SearchPrefix, null>;
  const prefix = PREFIXES.includes(prefixChar) ? prefixChar : null;

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
