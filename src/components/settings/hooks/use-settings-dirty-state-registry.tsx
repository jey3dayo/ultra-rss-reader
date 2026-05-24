import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from "react";
import {
  createSettingsDirtyStateRegistry,
  EMPTY_SETTINGS_DIRTY_STATE_SNAPSHOT,
  type SettingsDirtyStateEntry,
  type SettingsDirtyStateRegistry,
  type SettingsDirtyStateSnapshot,
} from "./settings-dirty-state-registry";

const SettingsDirtyStateRegistryContext = createContext<SettingsDirtyStateRegistry | null>(null);

export function SettingsDirtyStateRegistryProvider({ children }: PropsWithChildren) {
  const registryRef = useRef<SettingsDirtyStateRegistry | null>(null);
  registryRef.current ??= createSettingsDirtyStateRegistry();

  return (
    <SettingsDirtyStateRegistryContext.Provider value={registryRef.current}>
      {children}
    </SettingsDirtyStateRegistryContext.Provider>
  );
}

export function useRegisterSettingsDirtyState(entry: SettingsDirtyStateEntry): void {
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
