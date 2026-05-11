import { type AppAction, isAppAction } from "@/lib/app-actions";

type CommandPaletteHistoryDocumentKind = "feed" | "tag" | "article";

export type CommandPaletteHistoryEntry =
  | { kind: "action"; id: AppAction }
  | { kind: CommandPaletteHistoryDocumentKind; id: string };

type CommandPaletteHistoryKind = CommandPaletteHistoryEntry["kind"];

const COMMAND_PALETTE_HISTORY_PREFIX: Record<CommandPaletteHistoryKind, string> = {
  action: "action:",
  feed: "feed:",
  tag: "tag:",
  article: "article:",
};

const COMMAND_PALETTE_HISTORY_PREFIX_ENTRIES: Array<[CommandPaletteHistoryKind, string]> = [
  ["action", COMMAND_PALETTE_HISTORY_PREFIX.action],
  ["feed", COMMAND_PALETTE_HISTORY_PREFIX.feed],
  ["tag", COMMAND_PALETTE_HISTORY_PREFIX.tag],
  ["article", COMMAND_PALETTE_HISTORY_PREFIX.article],
];

export function createCommandPaletteHistoryValue(entry: CommandPaletteHistoryEntry): string {
  return `${COMMAND_PALETTE_HISTORY_PREFIX[entry.kind]}${entry.id}`;
}

export function parseCommandPaletteHistoryEntry(value: string): CommandPaletteHistoryEntry | null {
  for (const [kind, prefix] of COMMAND_PALETTE_HISTORY_PREFIX_ENTRIES) {
    if (!value.startsWith(prefix)) {
      continue;
    }

    const rawId = value.slice(prefix.length);
    if (rawId.length === 0) {
      return null;
    }

    if (kind === "action") {
      return isAppAction(rawId) ? { kind, id: rawId } : null;
    }

    const id = rawId.trim();
    if (id.length === 0) {
      return null;
    }

    return { kind, id };
  }

  return null;
}
