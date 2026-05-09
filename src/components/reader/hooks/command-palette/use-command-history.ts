import { MAX_COMMAND_HISTORY, STORAGE_KEYS } from "@/constants/storage";
import { parseJsonWithSchemaOrNull } from "@/schemas/parse";
import { CommandHistoryStorageSchema } from "@/schemas/storage";

function readStorage(): Storage | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function getHistory(): string[] {
  const storage = readStorage();
  if (!storage) {
    return [];
  }

  try {
    const raw = storage.getItem(STORAGE_KEYS.commandHistory);
    if (!raw) {
      return [];
    }

    return parseJsonWithSchemaOrNull(raw, CommandHistoryStorageSchema) ?? [];
  } catch {
    return [];
  }
}

export function compactCommandHistory(entries: readonly string[], id: string): string[] {
  const cleanEntries = entries.filter((entry) => entry.trim().length > 0);
  if (id.trim().length === 0) {
    return cleanEntries.slice(0, MAX_COMMAND_HISTORY);
  }

  return [id, ...cleanEntries.filter((entry) => entry !== id)].slice(0, MAX_COMMAND_HISTORY);
}

export function addToHistory(id: string): void {
  const storage = readStorage();
  if (!storage) {
    return;
  }

  try {
    const next = compactCommandHistory(getHistory(), id);
    storage.setItem(STORAGE_KEYS.commandHistory, JSON.stringify(next));
  } catch {
    // Ignore storage failures so the palette still works in constrained environments.
  }
}

export function clearHistory(): void {
  const storage = readStorage();
  if (!storage) {
    return;
  }

  try {
    storage.removeItem(STORAGE_KEYS.commandHistory);
  } catch {
    // Ignore storage failures so callers do not need to handle persistence errors.
  }
}
