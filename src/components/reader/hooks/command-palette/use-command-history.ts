import { STORAGE_KEYS } from "@/constants/storage";
import { CommandHistoryStorageSchema } from "@/schemas/storage";

type CommandHistoryStorageFailureKind = "unavailable" | "normalize" | "read" | "write" | "clear";

const warnedStorageFailureKinds = new Set<CommandHistoryStorageFailureKind>();

function resetCommandHistoryStorageFailure(kind: CommandHistoryStorageFailureKind): void {
  warnedStorageFailureKinds.delete(kind);
}

function logCommandHistoryStorageFailure(message: string, error: unknown): void {
  if (!import.meta.env.DEV) {
    return;
  }

  console.warn(message, error);
}

function warnCommandHistoryStorageFailureOnce(
  kind: CommandHistoryStorageFailureKind,
  message: string,
  error: unknown,
): void {
  if (warnedStorageFailureKinds.has(kind)) {
    return;
  }

  warnedStorageFailureKinds.add(kind);
  logCommandHistoryStorageFailure(message, error);
}

function readStorage(): Storage | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const storage = window.localStorage;
    resetCommandHistoryStorageFailure("unavailable");
    return storage;
  } catch (error) {
    warnCommandHistoryStorageFailureOnce("unavailable", "Command history localStorage is unavailable.", error);
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
    resetCommandHistoryStorageFailure("normalize");
  } catch (error) {
    warnCommandHistoryStorageFailureOnce("normalize", "Failed to normalize command history in localStorage.", error);
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
    resetCommandHistoryStorageFailure("read");
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
    warnCommandHistoryStorageFailureOnce("read", "Failed to read command history from localStorage.", error);
    return [];
  }
}

export function compactCommandHistory(entries: readonly string[], id: string): string[] {
  const [normalizedId] = CommandHistoryStorageSchema.parse([id]);
  if (!normalizedId) {
    return CommandHistoryStorageSchema.parse(entries);
  }

  return CommandHistoryStorageSchema.parse([normalizedId, ...entries]);
}

export function addToHistory(id: string): void {
  const storage = readStorage();
  if (!storage) {
    return;
  }

  try {
    const next = compactCommandHistory(getHistory(), id);
    storage.setItem(STORAGE_KEYS.commandHistory, JSON.stringify(next));
    resetCommandHistoryStorageFailure("write");
  } catch (error) {
    warnCommandHistoryStorageFailureOnce("write", "Failed to write command history to localStorage.", error);
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
    resetCommandHistoryStorageFailure("clear");
  } catch (error) {
    warnCommandHistoryStorageFailureOnce("clear", "Failed to clear command history from localStorage.", error);
    // Ignore storage failures so callers do not need to handle persistence errors.
  }
}
