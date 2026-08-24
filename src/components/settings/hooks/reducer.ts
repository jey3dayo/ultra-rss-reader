import type { DatabaseRuntimeRecoverySurface, DatabaseSizeStatus } from "./recovery";

/**
 * The reducer owns render-local state transitions for the data settings hook.
 * Native command orchestration and shared action lifetime stay in the facade
 * and lifecycle module, so this module remains a pure state transition seam.
 */

/**
 * State changes are intentionally represented as named actions. This keeps
 * command completion, recovery classification, and loading flags separate so
 * the facade can compose asynchronous effects without embedding them in the
 * reducer. A ready database size also clears an older recovery surface, while
 * an error preserves the classified surface for the view to render.
 */
export type DataSettingsControllerState = {
  databaseSizeStatus: DatabaseSizeStatus;
  totalSize: number | null;
  databaseRuntimeRecoverySurface: DatabaseRuntimeRecoverySurface | null;
  vacuuming: boolean;
  backingUp: boolean;
  openingLogDir: boolean;
  exportingSettingsProfile: boolean;
  importingSettingsProfile: boolean;
};

export type DataSettingsControllerAction =
  | { type: "set-database-size-ready"; value: number }
  | {
      type: "set-database-size-error";
      recoverySurface: DatabaseRuntimeRecoverySurface | null;
    }
  | {
      type: "set-database-runtime-recovery-surface";
      recoverySurface: DatabaseRuntimeRecoverySurface | null;
    }
  | { type: "set-vacuuming"; value: boolean }
  | { type: "set-backing-up"; value: boolean }
  | { type: "set-opening-log-dir"; value: boolean }
  | { type: "set-exporting-settings-profile"; value: boolean }
  | { type: "set-importing-settings-profile"; value: boolean };

/**
 * The action union intentionally contains only render state. Native calls,
 * toast policy, and request revision checks remain outside this pure module.
 */
// Keep the initial render contract explicit so every controller starts from
// the same loading and idle action state before its first native request.
export const initialDataSettingsControllerState: DataSettingsControllerState = {
  databaseSizeStatus: "loading",
  totalSize: null,
  databaseRuntimeRecoverySurface: null,
  vacuuming: false,
  backingUp: false,
  openingLogDir: false,
  exportingSettingsProfile: false,
  importingSettingsProfile: false,
};

/**
 * Apply one user-visible state transition without executing side effects.
 * Unknown actions remain a no-op for forward-compatible callers.
 */
export function dataSettingsControllerReducer(
  state: DataSettingsControllerState,
  action: DataSettingsControllerAction,
): DataSettingsControllerState {
  switch (action.type) {
    case "set-database-size-ready":
      return {
        ...state,
        databaseSizeStatus: "ready",
        totalSize: action.value,
        databaseRuntimeRecoverySurface: null,
      };
    case "set-database-size-error":
      return {
        ...state,
        databaseSizeStatus: "error",
        totalSize: null,
        databaseRuntimeRecoverySurface: action.recoverySurface,
      };
    case "set-database-runtime-recovery-surface":
      return {
        ...state,
        databaseRuntimeRecoverySurface: action.recoverySurface,
      };
    case "set-vacuuming":
      return { ...state, vacuuming: action.value };
    case "set-backing-up":
      return { ...state, backingUp: action.value };
    case "set-opening-log-dir":
      return { ...state, openingLogDir: action.value };
    case "set-exporting-settings-profile":
      return { ...state, exportingSettingsProfile: action.value };
    case "set-importing-settings-profile":
      return { ...state, importingSettingsProfile: action.value };
    default:
      return state;
  }
}
