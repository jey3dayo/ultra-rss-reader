import { type AppAction, isAppAction } from "@/lib/actions";

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
  for (const [kind, prefix] of Object.entries(COMMAND_PALETTE_HISTORY_PREFIX) as Array<
    [keyof typeof COMMAND_PALETTE_HISTORY_PREFIX, string]
  >) {
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
