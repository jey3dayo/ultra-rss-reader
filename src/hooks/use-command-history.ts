import { MAX_COMMAND_HISTORY, STORAGE_KEYS } from "@/constants/storage";
import { CommandHistoryStorageSchema } from "@/schemas/storage";

function readStorage(): Storage | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage;
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

    const parsed = CommandHistoryStorageSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) {
      return [];
    }

    return parsed.data;
  } catch {
    return [];
  }
}

export function addToHistory(id: string): void {
  const storage = readStorage();
  if (!storage) {
    return;
  }

  try {
    const next = [id, ...getHistory().filter((entry) => entry !== id)].slice(0, MAX_COMMAND_HISTORY);
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
