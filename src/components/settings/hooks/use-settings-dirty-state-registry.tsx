import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from "react";

export type SettingsDirtyStateOwner =
  | "account"
  | "tag"
  | "shortcut"
  | "preferences"
  | "data";

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

type SettingsDirtyStateRegistry = {
  getSnapshot: () => SettingsDirtyStateSnapshot;
  subscribe: (listener: () => void) => () => void;
  setEntry: (entry: SettingsDirtyStateEntry) => void;
  deleteEntry: (owner: SettingsDirtyStateOwner) => void;
};

const EMPTY_SETTINGS_DIRTY_STATE_SNAPSHOT: SettingsDirtyStateSnapshot = {
  dirty: false,
  pending: false,
  blockingReasons: [],
  entries: [],
};

const SettingsDirtyStateRegistryContext =
  createContext<SettingsDirtyStateRegistry | null>(null);
let latestSettingsDirtyStateSnapshot = EMPTY_SETTINGS_DIRTY_STATE_SNAPSHOT;

export function getSettingsDirtyStateSnapshot(): SettingsDirtyStateSnapshot {
  return latestSettingsDirtyStateSnapshot;
}

export function createSettingsDirtyStateSnapshot(
  entries: SettingsDirtyStateEntry[],
): SettingsDirtyStateSnapshot {
  const activeEntries = entries.filter(
    (entry) => entry.dirty || entry.pending || entry.blockingReason !== null,
  );
  return {
    dirty: activeEntries.some((entry) => entry.dirty),
    pending: activeEntries.some((entry) => entry.pending),
    blockingReasons: activeEntries.flatMap((entry) =>
      entry.blockingReason === null ? [] : [entry.blockingReason],
    ),
    entries: activeEntries,
  };
}

function createSettingsDirtyStateRegistry(): SettingsDirtyStateRegistry {
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

export function SettingsDirtyStateRegistryProvider({
  children,
}: PropsWithChildren) {
  const registryRef = useRef<SettingsDirtyStateRegistry | null>(null);
  registryRef.current ??= createSettingsDirtyStateRegistry();

  return (
    <SettingsDirtyStateRegistryContext.Provider value={registryRef.current}>
      {children}
    </SettingsDirtyStateRegistryContext.Provider>
  );
}

export function useRegisterSettingsDirtyState(
  entry: SettingsDirtyStateEntry,
): void {
  const registry = useContext(SettingsDirtyStateRegistryContext);
  const { owner, dirty, pending, blockingReason } = entry;
  const stableEntry = useMemo(
    () => ({
      owner,
      dirty,
      pending,
      blockingReason,
    }),
    [owner, dirty, pending, blockingReason],
  );

  useEffect(() => {
    if (registry === null) {
      return;
    }

    registry.setEntry(stableEntry);
    return () => registry.deleteEntry(stableEntry.owner);
  }, [registry, stableEntry]);
}

export function useSettingsDirtyStateRegistrySnapshot(): SettingsDirtyStateSnapshot {
  const registry = useContext(SettingsDirtyStateRegistryContext);
  return useSyncExternalStore(
    registry?.subscribe ?? (() => () => undefined),
    registry?.getSnapshot ?? (() => EMPTY_SETTINGS_DIRTY_STATE_SNAPSHOT),
    () => EMPTY_SETTINGS_DIRTY_STATE_SNAPSHOT,
  );
}
