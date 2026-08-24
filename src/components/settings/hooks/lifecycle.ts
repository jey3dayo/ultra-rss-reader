import type { DataSettingsControllerState } from "./reducer";

/**
 * Data settings actions can outlive one settings panel render. Keeping this
 * lifecycle at module scope lets a reopened panel observe an action that was
 * started by the previous panel instance and refresh its database size after
 * the shared action completes.
 */

/**
 * Lifecycle invariants are deliberately kept here rather than in the hook:
 *
 * - starting an already-running action is a no-op;
 * - only vacuum completion records an owner, because reopening after vacuum
 *   needs to distinguish the controller that initiated the request;
 * - every listener receives an immutable snapshot of the current flags; and
 * - unmount cleanup removes only the caller's listener.
 *
 * The module does not start commands or schedule work. It only coordinates
 * synchronous state notifications between mounted controller instances.
 */
export type DataSettingsActionKey = "vacuuming" | "openingLogDir";

/** Stable identity used to suppress a controller's own completion refresh. */
export type DataSettingsActionOwnerId = symbol;

/**
 * The lifecycle snapshot is intentionally private. Callers can observe flags
 * and completion ownership, but they cannot mutate shared state without using
 * setDataSettingsActionLifecycle. This keeps notifications ordered through a
 * single transition point and avoids exposing a store-like API for a feature
 * that only needs two maintenance flags.
 */
type DataSettingsActionLifecycle = Pick<DataSettingsControllerState, DataSettingsActionKey> & {
  vacuumingOwnerId: DataSettingsActionOwnerId | null;
  lastCompletedVacuumOwnerId: DataSettingsActionOwnerId | null;
};

const dataSettingsActionLifecycle: DataSettingsActionLifecycle = {
  vacuuming: false,
  openingLogDir: false,
  vacuumingOwnerId: null,
  lastCompletedVacuumOwnerId: null,
};

/**
 * Subscribers are controller instances, not individual buttons. A controller
 * registers once during mount and removes its own callback during unmount, so
 * the shared action state survives settings navigation without retaining a
 * stale component callback.
 */
// A Set keeps repeated subscription cleanup idempotent across StrictMode mounts.
const dataSettingsActionLifecycleListeners = new Set<(lifecycle: DataSettingsActionLifecycle) => void>();

/** Return a snapshot so observers cannot mutate the shared lifecycle object. */
export function getDataSettingsActionLifecycle(): DataSettingsActionLifecycle {
  return { ...dataSettingsActionLifecycle };
}

/** Report whether a shared maintenance action currently blocks another action. */
export function isDataSettingsActionInFlight(): boolean {
  return dataSettingsActionLifecycle.vacuuming || dataSettingsActionLifecycle.openingLogDir;
}

/** Subscribe a mounted controller to lifecycle changes and return its cleanup. */
export function subscribeToDataSettingsActionLifecycle(
  listener: (lifecycle: DataSettingsActionLifecycle) => void,
): () => void {
  dataSettingsActionLifecycleListeners.add(listener);
  return () => {
    dataSettingsActionLifecycleListeners.delete(listener);
  };
}

/**
 * Update shared action state and notify all currently mounted controllers.
 * Completion ownership is supplied only by vacuum callers; log-directory
 * actions use the same flags but do not trigger a database refresh owner.
 * Notifications run synchronously before the command caller continues.
 * No listener is invoked after it has unsubscribed.
 * This preserves the existing reopen-and-refresh behavior.
 */
export function setDataSettingsActionLifecycle(
  actionKey: DataSettingsActionKey,
  value: boolean,
  ownerId?: DataSettingsActionOwnerId,
): void {
  if (dataSettingsActionLifecycle[actionKey] === value) {
    return;
  }
  dataSettingsActionLifecycle[actionKey] = value;
  if (actionKey === "vacuuming") {
    dataSettingsActionLifecycle.vacuumingOwnerId = value ? (ownerId ?? null) : null;
    dataSettingsActionLifecycle.lastCompletedVacuumOwnerId = value ? null : (ownerId ?? null);
  }
  const lifecycle = getDataSettingsActionLifecycle();
  for (const listener of dataSettingsActionLifecycleListeners) {
    listener(lifecycle);
  }
}
