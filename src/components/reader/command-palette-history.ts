import { type AppAction, isAppAction } from "@/lib/app-actions";

export type CommandPaletteHistoryEntry =
  | { kind: "action"; id: AppAction }
  | { kind: "feed" | "tag" | "article"; id: string };

export const COMMAND_PALETTE_HISTORY_PREFIX = {
  action: "action:",
  feed: "feed:",
  tag: "tag:",
  article: "article:",
} as const;

const COMMAND_PALETTE_HISTORY_PREFIX_ENTRIES = [
  ["action", COMMAND_PALETTE_HISTORY_PREFIX.action],
  ["feed", COMMAND_PALETTE_HISTORY_PREFIX.feed],
  ["tag", COMMAND_PALETTE_HISTORY_PREFIX.tag],
  ["article", COMMAND_PALETTE_HISTORY_PREFIX.article],
] as const;

export function createCommandPaletteHistoryValue(entry: CommandPaletteHistoryEntry): string {
  return `${COMMAND_PALETTE_HISTORY_PREFIX[entry.kind]}${entry.id}`;
}

export function parseCommandPaletteHistoryEntry(value: string): CommandPaletteHistoryEntry | null {
  for (const [kind, prefix] of COMMAND_PALETTE_HISTORY_PREFIX_ENTRIES) {
    if (!value.startsWith(prefix)) {
      continue;
    }

    const id = value.slice(prefix.length);
    if (kind === "action") {
      return isAppAction(id) ? { kind, id } : null;
    }

    return { kind, id };
  }

  return null;
}
