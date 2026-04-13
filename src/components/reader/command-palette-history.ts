import type { AppAction } from "@/lib/actions";

export type CommandPaletteHistoryEntry =
  | { kind: "action"; id: AppAction }
  | { kind: "feed" | "tag" | "article"; id: string };

export const COMMAND_PALETTE_HISTORY_PREFIX = {
  action: "action:",
  feed: "feed:",
  tag: "tag:",
  article: "article:",
} as const;

export function createCommandPaletteHistoryValue(entry: CommandPaletteHistoryEntry): string {
  return `${COMMAND_PALETTE_HISTORY_PREFIX[entry.kind]}${entry.id}`;
}

export function parseCommandPaletteHistoryEntry(value: string): CommandPaletteHistoryEntry | null {
  if (value.startsWith(COMMAND_PALETTE_HISTORY_PREFIX.action)) {
    return {
      kind: "action",
      id: value.slice(COMMAND_PALETTE_HISTORY_PREFIX.action.length) as AppAction,
    };
  }
  if (value.startsWith(COMMAND_PALETTE_HISTORY_PREFIX.feed)) {
    return { kind: "feed", id: value.slice(COMMAND_PALETTE_HISTORY_PREFIX.feed.length) };
  }
  if (value.startsWith(COMMAND_PALETTE_HISTORY_PREFIX.tag)) {
    return { kind: "tag", id: value.slice(COMMAND_PALETTE_HISTORY_PREFIX.tag.length) };
  }
  if (value.startsWith(COMMAND_PALETTE_HISTORY_PREFIX.article)) {
    return { kind: "article", id: value.slice(COMMAND_PALETTE_HISTORY_PREFIX.article.length) };
  }
  return null;
}
