import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from "react";
import {
  createSettingsDirtyStateRegistry,
  EMPTY_SETTINGS_DIRTY_STATE_SNAPSHOT,
  type SettingsDirtyStateActions,
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

export function useRegisterSettingsDirtyState(
  entry: SettingsDirtyStateEntry,
  actions?: SettingsDirtyStateActions,
): void {
  const registry = useContext(SettingsDirtyStateRegistryContext);
  const actionsRef = useRef<SettingsDirtyStateActions | undefined>(undefined);
  useLayoutEffect(() => {
    actionsRef.current = actions;
  });
  const { owner, dirty, pending, blockingReason } = entry;
  const hasActions = actions !== undefined;
  const stableActions = useMemo(
    () =>
      hasActions
        ? {
            save: () => actionsRef.current?.save() ?? Promise.resolve(true),
            discard: () => actionsRef.current?.discard(),
          }
        : undefined,
    [hasActions],
  );
  const stableEntry = useMemo(
    () => ({
      owner,
      dirty,
      pending,
      blockingReason,
      actions: stableActions,
    }),
    [owner, dirty, pending, blockingReason, stableActions],
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
