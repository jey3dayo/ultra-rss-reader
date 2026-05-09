import { MAX_COMMAND_HISTORY, STORAGE_KEYS } from "@/constants/storage";
import { CommandHistoryStorageSchema } from "@/schemas/storage";

function logCommandHistoryStorageFailure(message: string, error: unknown): void {
  console.warn(message, error);
}

function readStorage(): Storage | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage;
  } catch (error) {
    logCommandHistoryStorageFailure("Command history localStorage is unavailable.", error);
    return null;
  }
}

function writeNormalizedHistory(storage: Storage, raw: string, history: readonly string[]): void {
  const normalized = JSON.stringify(history);
  if (raw === normalized) {
    return;
  }

  try {
    storage.setItem(STORAGE_KEYS.commandHistory, normalized);
  } catch (error) {
    logCommandHistoryStorageFailure("Failed to normalize command history in localStorage.", error);
    // Ignore cleanup write failures; callers can still use the normalized in-memory history.
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

    const result = CommandHistoryStorageSchema.safeParse(JSON.parse(raw) as unknown);
    if (!result.success) {
      return [];
    }

    const history = result.data;
    writeNormalizedHistory(storage, raw, history);
    return history;
  } catch (error) {
    logCommandHistoryStorageFailure("Failed to read command history from localStorage.", error);
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
  } catch (error) {
    logCommandHistoryStorageFailure("Failed to write command history to localStorage.", error);
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
  } catch (error) {
    logCommandHistoryStorageFailure("Failed to clear command history from localStorage.", error);
    // Ignore storage failures so callers do not need to handle persistence errors.
  }
}
