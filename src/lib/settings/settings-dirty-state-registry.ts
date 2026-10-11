type SettingsDirtyStateOwner = "account" | "tag" | "shortcut" | "preferences" | "data";

export type SettingsDirtyStateEntry = {
  owner: SettingsDirtyStateOwner;
  dirty: boolean;
  pending: boolean;
  blockingReason: string | null;
};

export type SettingsDirtyStateSnapshot = {
  dirty: boolean;
  pending: boolean;
  blockingReasons: string[];
  entries: SettingsDirtyStateEntry[];
};

export type SettingsDirtyStateRegistry = {
  getSnapshot: () => SettingsDirtyStateSnapshot;
  subscribe: (listener: () => void) => () => void;
  setEntry: (entry: SettingsDirtyStateEntry) => void;
  deleteEntry: (owner: SettingsDirtyStateOwner) => void;
};

export const EMPTY_SETTINGS_DIRTY_STATE_SNAPSHOT: SettingsDirtyStateSnapshot = {
  dirty: false,
  pending: false,
  blockingReasons: [],
  entries: [],
};

let latestSettingsDirtyStateSnapshot = EMPTY_SETTINGS_DIRTY_STATE_SNAPSHOT;

export function getSettingsDirtyStateSnapshot(): SettingsDirtyStateSnapshot {
  return latestSettingsDirtyStateSnapshot;
}

export function createSettingsDirtyStateSnapshot(entries: SettingsDirtyStateEntry[]): SettingsDirtyStateSnapshot {
  const activeEntries = entries.filter((entry) => entry.dirty || entry.pending || entry.blockingReason !== null);
  return {
    dirty: activeEntries.some((entry) => entry.dirty),
    pending: activeEntries.some((entry) => entry.pending),
    blockingReasons: activeEntries.flatMap((entry) => (entry.blockingReason === null ? [] : [entry.blockingReason])),
    entries: activeEntries,
  };
}

export function createSettingsDirtyStateRegistry(): SettingsDirtyStateRegistry {
  const entries = new Map<SettingsDirtyStateOwner, SettingsDirtyStateEntry>();
  const listeners = new Set<() => void>();
  let snapshot = EMPTY_SETTINGS_DIRTY_STATE_SNAPSHOT;

  const notify = () => {
    snapshot = createSettingsDirtyStateSnapshot([...entries.values()]);
    latestSettingsDirtyStateSnapshot = snapshot;
    for (const listener of listeners) {
      listener();
    }
  };

  return {
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    setEntry: (entry) => {
      entries.set(entry.owner, entry);
      notify();
    },
    deleteEntry: (owner) => {
      entries.delete(owner);
      notify();
    },
  };
}
