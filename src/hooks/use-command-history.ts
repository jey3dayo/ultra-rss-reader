export const HISTORY_KEY = "ultra-rss:command-history";
export const MAX_HISTORY = 10;

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
    const raw = storage.getItem(HISTORY_KEY);
    if (!raw) {
      return [];
    }

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((item): item is string => typeof item === "string");
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
    const next = [id, ...getHistory().filter((entry) => entry !== id)].slice(0, MAX_HISTORY);
    storage.setItem(HISTORY_KEY, JSON.stringify(next));
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
    storage.removeItem(HISTORY_KEY);
  } catch {
    // Ignore storage failures so callers do not need to handle persistence errors.
  }
}
