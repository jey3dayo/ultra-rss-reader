import type { AppError } from "@/api/tauri-commands";
import {
  BYTES_PER_KIBIBYTE,
  BYTES_PER_MEBIBYTE,
  DATA_SIZE_FRACTION_DIGITS,
  DATA_SIZE_UNIT_LABELS,
} from "@/constants/data-size";
import { logRuntimeDiagnostic } from "@/lib/runtime/diagnostics";

export type DatabaseSizeStatus = "loading" | "ready" | "error";

export type DatabaseRuntimeFailureKind =
  | "read_corruption"
  | "write_corruption"
  | "migration_failed"
  | "downgrade_blocked"
  | "locked"
  | "permission_denied"
  | "disk_full";

export type DatabaseRuntimeRecoveryMode =
  | "read_only_degraded"
  | "startup_blocked"
  | "retry_when_idle"
  | "user_permission_fix"
  | "free_disk_space";

export type DatabaseRuntimeRecoveryAction =
  | "run_integrity_check"
  | "restore_backup"
  | "preserve_backup_and_restart"
  | "retry"
  | "check_os_permissions"
  | "free_disk_space";

export type DatabaseRecoveryActionSafety = "read_only" | "requires_dry_run" | "requires_explicit_confirmation";

export type DatabaseRuntimeRecoverySurface = {
  failureKind: DatabaseRuntimeFailureKind;
  mode: DatabaseRuntimeRecoveryMode;
  actions: readonly DatabaseRuntimeRecoveryAction[];
  actionSafety: readonly DatabaseRecoveryActionSafety[];
  diagnosticsIdRequired: true;
};

type DatabaseRuntimeOperation = "read" | "write";

function getAppErrorMessage(error: AppError): string {
  return error.message;
}

function isDatabaseLockedMessage(message: string): boolean {
  return /\b(database is )?(busy|locked)\b/i.test(message);
}

function isPermissionDeniedMessage(message: string): boolean {
  return /permission denied|access denied|readonly database|read-only database/i.test(message);
}

function isDiskFullMessage(message: string): boolean {
  return /disk full|database or disk is full|no space left/i.test(message);
}

function isDatabaseCorruptionMessage(message: string): boolean {
  return /corrupt|malformed|not a database|file is not a database|database disk image is malformed/i.test(message);
}

function isDatabaseDowngradeMessage(message: string): boolean {
  return /newer than this application supports|downgrade startup is blocked/i.test(message);
}

function isDatabaseMigrationMessage(message: string): boolean {
  return /migration error|migration failed|failed migration|schema_version/i.test(message);
}

export function classifyDatabaseRuntimeRecoverySurface(
  error: AppError,
  operation: DatabaseRuntimeOperation,
): DatabaseRuntimeRecoverySurface | null {
  const message = getAppErrorMessage(error);
  if (isDatabaseDowngradeMessage(message)) {
    return {
      failureKind: "downgrade_blocked",
      mode: "startup_blocked",
      actions: ["preserve_backup_and_restart", "restore_backup"],
      actionSafety: ["read_only", "requires_explicit_confirmation"],
      diagnosticsIdRequired: true,
    };
  }
  if (isDatabaseMigrationMessage(message)) {
    return {
      failureKind: "migration_failed",
      mode: "startup_blocked",
      actions: ["preserve_backup_and_restart", "restore_backup"],
      actionSafety: ["read_only", "requires_explicit_confirmation"],
      diagnosticsIdRequired: true,
    };
  }
  if (isDatabaseLockedMessage(message)) {
    return {
      failureKind: "locked",
      mode: "retry_when_idle",
      actions: ["retry"],
      actionSafety: ["read_only"],
      diagnosticsIdRequired: true,
    };
  }
  if (isPermissionDeniedMessage(message)) {
    return {
      failureKind: "permission_denied",
      mode: "user_permission_fix",
      actions: ["check_os_permissions"],
      actionSafety: ["read_only"],
      diagnosticsIdRequired: true,
    };
  }
  if (isDiskFullMessage(message)) {
    return {
      failureKind: "disk_full",
      mode: "free_disk_space",
      actions: ["free_disk_space"],
      actionSafety: ["read_only"],
      diagnosticsIdRequired: true,
    };
  }
  if (isDatabaseCorruptionMessage(message)) {
    return {
      failureKind: operation === "read" ? "read_corruption" : "write_corruption",
      mode: "read_only_degraded",
      actions: ["run_integrity_check", "restore_backup"],
      actionSafety: ["read_only", "requires_explicit_confirmation"],
      diagnosticsIdRequired: true,
    };
  }
  return null;
}

export function logDatabaseRuntimeRecoverySurface(
  recoverySurface: DatabaseRuntimeRecoverySurface | null,
  operation: DatabaseRuntimeOperation,
  error: AppError,
): void {
  if (recoverySurface === null) {
    return;
  }
  logRuntimeDiagnostic("database-runtime-recovery", "Database runtime recovery surface detected", {
    operation,
    failureKind: recoverySurface.failureKind,
    mode: recoverySurface.mode,
    actions: recoverySurface.actions,
    diagnosticsIdRequired: recoverySurface.diagnosticsIdRequired,
    message: error.message,
  });
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return `0 ${DATA_SIZE_UNIT_LABELS.byte}`;
  }
  if (bytes < BYTES_PER_KIBIBYTE) {
    return `${bytes} ${DATA_SIZE_UNIT_LABELS.byte}`;
  }
  if (bytes < BYTES_PER_MEBIBYTE) {
    return `${(bytes / BYTES_PER_KIBIBYTE).toFixed(DATA_SIZE_FRACTION_DIGITS)} ${DATA_SIZE_UNIT_LABELS.kibibyte}`;
  }
  return `${(bytes / BYTES_PER_MEBIBYTE).toFixed(DATA_SIZE_FRACTION_DIGITS)} ${DATA_SIZE_UNIT_LABELS.mebibyte}`;
}
