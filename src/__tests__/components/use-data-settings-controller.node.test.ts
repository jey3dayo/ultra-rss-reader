import { Result } from "@praha/byethrow";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { setupBrowserTestDom } from "@tests/helpers/browser-test-globals";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DatabaseInfoDtoSchema } from "@/api/schemas/database-info";
import {
  exportSettingsProfile,
  getDatabaseInfo,
  importSettingsProfile,
  openLogDir,
  vacuumDatabase,
} from "@/api/tauri-commands";
import type { DatabaseRecoveryActionSafety } from "@/components/settings/hooks/use-data-settings-controller";
import {
  classifyDatabaseRuntimeRecoverySurface,
  formatBytes,
  reconcileDatabaseRestoreFrontendState,
  useDataSettingsController,
} from "@/components/settings/hooks/use-data-settings-controller";
import { STORAGE_KEYS } from "@/constants/storage";

setupBrowserTestDom();

afterEach(() => {
  cleanup();
});

vi.mock("@/api/tauri-commands", () => ({
  exportSettingsProfile: vi.fn(async () => Result.succeed("{}")),
  getDatabaseInfo: vi.fn(async () =>
    Result.succeed({
      db_size_bytes: 1024,
      wal_size_bytes: 0,
      shm_size_bytes: 0,
      total_size_bytes: 1024,
    }),
  ),
  openLogDir: vi.fn(async () => Result.succeed(null)),
  importSettingsProfile: vi.fn(async () =>
    Result.succeed({
      accounts_created: 0,
      accounts_updated: 0,
      preferences_imported: 0,
      preferences_skipped: 0,
      tags_created: 0,
      tags_updated: 0,
      mute_keywords_created: 0,
      mute_keywords_skipped: 0,
    }),
  ),
  vacuumDatabase: vi.fn(async () =>
    Result.succeed({
      db_size_bytes: 512,
      wal_size_bytes: 0,
      shm_size_bytes: 0,
      total_size_bytes: 512,
    }),
  ),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getDatabaseInfo).mockResolvedValue(
    Result.succeed({
      db_size_bytes: 1024,
      wal_size_bytes: 0,
      shm_size_bytes: 0,
      total_size_bytes: 1024,
    }),
  );
  vi.mocked(exportSettingsProfile).mockResolvedValue(Result.succeed("{}"));
  vi.mocked(importSettingsProfile).mockResolvedValue(
    Result.succeed({
      accounts_created: 0,
      accounts_updated: 0,
      preferences_imported: 0,
      preferences_skipped: 0,
      tags_created: 0,
      tags_updated: 0,
      mute_keywords_created: 0,
      mute_keywords_skipped: 0,
    }),
  );
});

describe("formatBytes", () => {
  it("formats byte, kibibyte, and mebibyte values for data settings", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1024)).toBe("1.0 KiB");
    expect(formatBytes(1536)).toBe("1.5 KiB");
    expect(formatBytes(1024 * 1024)).toBe("1.0 MiB");
  });

  it("falls back to 0 B for invalid database size DTO values", () => {
    expect(formatBytes(-1)).toBe("0 B");
    expect(formatBytes(Number.NaN)).toBe("0 B");
    expect(formatBytes(Number.POSITIVE_INFINITY)).toBe("0 B");
  });
});

describe("data recovery safety contract", () => {
  it("keeps dry-run safety representable in the settings data recovery contract", () => {
    const safety: readonly DatabaseRecoveryActionSafety[] = [
      "read_only",
      "requires_dry_run",
      "requires_explicit_confirmation",
    ];

    expect(safety).toContain("requires_dry_run");
  });
});

describe("classifyDatabaseRuntimeRecoverySurface", () => {
  it("maps migration and downgrade startup failures to blocked recovery surfaces", () => {
    expect(
      classifyDatabaseRuntimeRecoverySurface(
        {
          type: "UserVisible",
          message: "Migration error: Migration failed: duplicate column",
        },
        "read",
      ),
    ).toEqual({
      failureKind: "migration_failed",
      mode: "startup_blocked",
      actions: ["preserve_backup_and_restart", "restore_backup"],
      actionSafety: ["read_only", "requires_explicit_confirmation"],
      diagnosticsIdRequired: true,
    });
    expect(
      classifyDatabaseRuntimeRecoverySurface(
        {
          type: "UserVisible",
          message:
            "Database schema version 19 is newer than this application supports (v18). Downgrade startup is blocked.",
        },
        "read",
      )?.failureKind,
    ).toBe("downgrade_blocked");
  });

  it("maps runtime database failures to recovery categories and user actions", () => {
    expect(
      classifyDatabaseRuntimeRecoverySurface(
        { type: "UserVisible", message: "database disk image is malformed" },
        "read",
      ),
    ).toEqual({
      failureKind: "read_corruption",
      mode: "read_only_degraded",
      actions: ["run_integrity_check", "restore_backup"],
      actionSafety: ["read_only", "requires_explicit_confirmation"],
      diagnosticsIdRequired: true,
    });
    expect(
      classifyDatabaseRuntimeRecoverySurface(
        {
          type: "UserVisible",
          message: "SQLITE_CORRUPT: database disk image is malformed",
        },
        "write",
      )?.failureKind,
    ).toBe("write_corruption");
    expect(
      classifyDatabaseRuntimeRecoverySurface({ type: "UserVisible", message: "Database is busy" }, "read"),
    ).toMatchObject({
      failureKind: "locked",
      mode: "retry_when_idle",
      actions: ["retry"],
    });
    expect(
      classifyDatabaseRuntimeRecoverySurface({ type: "UserVisible", message: "permission denied" }, "read"),
    ).toMatchObject({
      failureKind: "permission_denied",
      mode: "user_permission_fix",
      actions: ["check_os_permissions"],
    });
    expect(
      classifyDatabaseRuntimeRecoverySurface({ type: "UserVisible", message: "database or disk is full" }, "write"),
    ).toMatchObject({
      failureKind: "disk_full",
      mode: "free_disk_space",
      actions: ["free_disk_space"],
    });
  });

  it("leaves unrelated command failures out of the database recovery surface", () => {
    expect(
      classifyDatabaseRuntimeRecoverySurface({ type: "UserVisible", message: "Account not found" }, "read"),
    ).toBeNull();
  });
});

describe("reconcileDatabaseRestoreFrontendState", () => {
  it("clears query cache, removes DB-derived localStorage, and repairs selected account state", () => {
    const queryClient = { clear: vi.fn() };
    const storage = {
      removeItem: vi.fn(),
    };
    const restoreAccountSelection = vi.fn();
    const clearSelectedAccount = vi.fn();
    const setSelectedAccountPreference = vi.fn();
    const clearSettingsDirtyState = vi.fn();

    const result = reconcileDatabaseRestoreFrontendState({
      accounts: [{ id: "acc-restored" }],
      selectedAccountId: "acc-deleted",
      savedAccountId: "acc-deleted",
      queryClient,
      storage,
      restoreAccountSelection,
      clearSelectedAccount,
      setSelectedAccountPreference,
      clearSettingsDirtyState,
    });

    expect(queryClient.clear).toHaveBeenCalledTimes(1);
    expect(clearSettingsDirtyState).toHaveBeenCalledTimes(1);
    expect(storage.removeItem).toHaveBeenCalledTimes(3);
    expect(storage.removeItem).toHaveBeenNthCalledWith(1, STORAGE_KEYS.commandHistory);
    expect(storage.removeItem).toHaveBeenNthCalledWith(2, STORAGE_KEYS.sidebarExpandedFolders);
    expect(storage.removeItem).toHaveBeenNthCalledWith(3, STORAGE_KEYS.startupSyncLastTriggeredAt);
    expect(restoreAccountSelection).toHaveBeenCalledWith("acc-restored", {
      focusedPane: "list",
    });
    expect(setSelectedAccountPreference).toHaveBeenCalledWith("acc-restored");
    expect(clearSelectedAccount).not.toHaveBeenCalled();
    expect(result).toEqual({
      queryCacheCleared: true,
      resetReason: "database-restore",
      removedStorageKeys: [
        STORAGE_KEYS.commandHistory,
        STORAGE_KEYS.sidebarExpandedFolders,
        STORAGE_KEYS.startupSyncLastTriggeredAt,
      ],
      selectedAccountId: "acc-restored",
      preferenceAccountId: "acc-restored",
      restartRequired: true,
    });
  });

  it("clears selected account and saved preference when restored DB has no accounts", () => {
    const queryClient = { clear: vi.fn() };
    const storage = {
      removeItem: vi.fn(),
    };
    const restoreAccountSelection = vi.fn();
    const clearSelectedAccount = vi.fn();
    const setSelectedAccountPreference = vi.fn();

    const result = reconcileDatabaseRestoreFrontendState({
      accounts: [],
      selectedAccountId: "acc-deleted",
      savedAccountId: "acc-deleted",
      queryClient,
      storage,
      restoreAccountSelection,
      clearSelectedAccount,
      setSelectedAccountPreference,
    });

    expect(queryClient.clear).toHaveBeenCalledTimes(1);
    expect(clearSelectedAccount).toHaveBeenCalledTimes(1);
    expect(setSelectedAccountPreference).toHaveBeenCalledWith("");
    expect(restoreAccountSelection).not.toHaveBeenCalled();
    expect(result.selectedAccountId).toBeNull();
    expect(result.preferenceAccountId).toBe("");
    expect(result.restartRequired).toBe(true);
  });

  it("continues account reconciliation when localStorage cleanup is unavailable", () => {
    const queryClient = { clear: vi.fn() };
    const storage = {
      removeItem: vi.fn(() => {
        throw new DOMException("localStorage blocked", "SecurityError");
      }),
    };
    const restoreAccountSelection = vi.fn();
    const clearSelectedAccount = vi.fn();
    const setSelectedAccountPreference = vi.fn();

    const result = reconcileDatabaseRestoreFrontendState({
      accounts: [{ id: "acc-restored" }],
      selectedAccountId: "acc-deleted",
      savedAccountId: "acc-deleted",
      queryClient,
      storage,
      restoreAccountSelection,
      clearSelectedAccount,
      setSelectedAccountPreference,
    });

    expect(queryClient.clear).toHaveBeenCalledTimes(1);
    expect(storage.removeItem).toHaveBeenCalledTimes(3);
    expect(restoreAccountSelection).toHaveBeenCalledWith("acc-restored", {
      focusedPane: "list",
    });
    expect(setSelectedAccountPreference).toHaveBeenCalledWith("acc-restored");
    expect(clearSelectedAccount).not.toHaveBeenCalled();
    expect(result.removedStorageKeys).toEqual([]);
  });

  it("uses the same frontend cleanup boundary after private data reset", () => {
    const queryClient = { clear: vi.fn() };
    const storage = {
      removeItem: vi.fn(),
    };
    const restoreAccountSelection = vi.fn();
    const clearSelectedAccount = vi.fn();
    const setSelectedAccountPreference = vi.fn();

    const result = reconcileDatabaseRestoreFrontendState({
      accounts: [{ id: "acc-after-reset" }],
      selectedAccountId: "acc-before-reset",
      savedAccountId: "acc-before-reset",
      resetReason: "private-data-reset",
      queryClient,
      storage,
      restoreAccountSelection,
      clearSelectedAccount,
      setSelectedAccountPreference,
    });

    expect(queryClient.clear).toHaveBeenCalledTimes(1);
    expect(storage.removeItem).toHaveBeenCalledTimes(3);
    expect(restoreAccountSelection).toHaveBeenCalledWith("acc-after-reset", {
      focusedPane: "list",
    });
    expect(setSelectedAccountPreference).toHaveBeenCalledWith("acc-after-reset");
    expect(clearSelectedAccount).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      queryCacheCleared: true,
      resetReason: "private-data-reset",
      selectedAccountId: "acc-after-reset",
      preferenceAccountId: "acc-after-reset",
      restartRequired: true,
    });
  });
});

describe("useDataSettingsController", () => {
  const renderDataSettingsController = ({
    setSettingsLoading = vi.fn(),
    showToast = vi.fn(),
  }: {
    setSettingsLoading?: (loading: boolean) => void;
    showToast?: (message: string) => void;
  } = {}) =>
    renderHook(() =>
      useDataSettingsController({
        t: ((key: string) => key) as never,
        showToast,
        setSettingsLoading,
      }),
    );

  it("reports loading and ready database size states without using placeholder text as state", async () => {
    const { result } = renderDataSettingsController();

    expect(result.current.databaseSizeStatus).toBe("loading");
    expect(result.current.databaseSizeValue).toBe("");

    await waitFor(() => {
      expect(result.current.databaseSizeStatus).toBe("ready");
    });

    expect(result.current.databaseSizeValue).toBe("1.0 KiB");
  });

  it("uses schema-validated total size including WAL and SHM for display and vacuum saved copy", async () => {
    const initialInfo = DatabaseInfoDtoSchema.parse({
      db_size_bytes: 1024,
      wal_size_bytes: 256,
      shm_size_bytes: 128,
      total_size_bytes: 1408,
    });
    const vacuumedInfo = DatabaseInfoDtoSchema.parse({
      db_size_bytes: 768,
      wal_size_bytes: 256,
      shm_size_bytes: 0,
      total_size_bytes: 1024,
    });
    vi.mocked(getDatabaseInfo).mockResolvedValue(Result.succeed(initialInfo));
    vi.mocked(vacuumDatabase).mockResolvedValue(Result.succeed(vacuumedInfo));
    const showToast = vi.fn();
    const { result } = renderHook(() =>
      useDataSettingsController({
        t: ((key: string, options?: { saved?: string }) =>
          key === "data.vacuum_success" ? `Saved ${options?.saved ?? ""}` : key) as never,
        showToast,
      }),
    );

    await waitFor(() => {
      expect(result.current.databaseSizeStatus).toBe("ready");
    });
    expect(result.current.databaseSizeValue).toBe("1.4 KiB");

    await act(async () => {
      await result.current.handleVacuum();
    });

    expect(result.current.databaseSizeValue).toBe("1.0 KiB");
    expect(showToast).toHaveBeenCalledWith("Saved -384 B");
  });

  it("clamps vacuum saved copy when the database grows after cleanup", async () => {
    const initialInfo = DatabaseInfoDtoSchema.parse({
      db_size_bytes: 1024,
      wal_size_bytes: 0,
      shm_size_bytes: 0,
      total_size_bytes: 1024,
    });
    const vacuumedInfo = DatabaseInfoDtoSchema.parse({
      db_size_bytes: 2048,
      wal_size_bytes: 0,
      shm_size_bytes: 0,
      total_size_bytes: 2048,
    });
    vi.mocked(getDatabaseInfo).mockResolvedValue(Result.succeed(initialInfo));
    vi.mocked(vacuumDatabase).mockResolvedValue(Result.succeed(vacuumedInfo));
    const showToast = vi.fn();
    const { result } = renderHook(() =>
      useDataSettingsController({
        t: ((key: string, options?: { saved?: string }) =>
          key === "data.vacuum_success" ? `Saved ${options?.saved ?? ""}` : key) as never,
        showToast,
      }),
    );

    await waitFor(() => {
      expect(result.current.databaseSizeStatus).toBe("ready");
    });

    await act(async () => {
      await result.current.handleVacuum();
    });

    expect(result.current.databaseSizeValue).toBe("2.0 KiB");
    expect(showToast).toHaveBeenCalledWith("Saved 0 B");
  });

  it("exports settings profile as a JSON download and blocks duplicate profile actions", async () => {
    let resolveExport: (value: ReturnType<typeof Result.succeed<string>>) => void = () => undefined;
    vi.mocked(exportSettingsProfile).mockReturnValue(
      new Promise((resolve) => {
        resolveExport = resolve;
      }),
    );
    const createObjectUrl = vi.fn(() => "blob:settings-profile");
    const revokeObjectUrl = vi.fn();
    const click = vi.spyOn(HTMLElement.prototype, "click").mockImplementation(() => undefined);
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: createObjectUrl,
      revokeObjectURL: revokeObjectUrl,
    });
    const showToast = vi.fn();
    const { result } = renderHook(() =>
      useDataSettingsController({
        t: ((key: string) => key) as never,
        showToast,
      }),
    );

    await waitFor(() => {
      expect(result.current.databaseSizeStatus).toBe("ready");
    });

    void act(() => {
      void result.current.handleExportSettingsProfile();
    });
    await waitFor(() => {
      expect(result.current.exportingSettingsProfile).toBe(true);
    });
    await act(async () => {
      await result.current.handleImportSettingsProfileFile(new File(["{}"], "profile.json"));
    });
    expect(importSettingsProfile).not.toHaveBeenCalled();

    await act(async () => {
      resolveExport(Result.succeed('{"version":1}'));
    });
    await waitFor(() => {
      expect(result.current.exportingSettingsProfile).toBe(false);
    });

    expect(exportSettingsProfile).toHaveBeenCalledTimes(1);
    expect(createObjectUrl).toHaveBeenCalledWith(expect.any(Blob));
    expect(click).toHaveBeenCalledTimes(1);
    expect(showToast).toHaveBeenCalledWith("data.settings_profile_export_success");

    click.mockRestore();
    vi.unstubAllGlobals();
  });

  it("imports settings profile files and reports merged counts", async () => {
    vi.mocked(importSettingsProfile).mockResolvedValue(
      Result.succeed({
        accounts_created: 1,
        accounts_updated: 2,
        preferences_imported: 3,
        preferences_skipped: 4,
        tags_created: 5,
        tags_updated: 6,
        mute_keywords_created: 7,
        mute_keywords_skipped: 8,
      }),
    );
    const showToast = vi.fn();
    const { result } = renderHook(() =>
      useDataSettingsController({
        t: ((key: string, options?: Record<string, number>) =>
          key === "data.settings_profile_import_success"
            ? `Imported ${options?.accountsCreated}/${options?.preferencesImported}/${options?.muteKeywordsSkipped}`
            : key) as never,
        showToast,
      }),
    );

    await waitFor(() => {
      expect(result.current.databaseSizeStatus).toBe("ready");
    });

    await act(async () => {
      await result.current.handleImportSettingsProfileFile(new File(['{"version":1}'], "profile.json"));
    });

    expect(importSettingsProfile).toHaveBeenCalledWith('{"version":1}');
    expect(showToast).toHaveBeenCalledWith("Imported 1/3/8");
  });

  it("exposes write corruption from vacuum as runtime recovery surface", async () => {
    const initialInfo = DatabaseInfoDtoSchema.parse({
      db_size_bytes: 1024,
      wal_size_bytes: 0,
      shm_size_bytes: 0,
      total_size_bytes: 1024,
    });
    vi.mocked(getDatabaseInfo).mockResolvedValue(Result.succeed(initialInfo));
    vi.mocked(vacuumDatabase).mockResolvedValue(
      Result.fail({
        type: "UserVisible",
        message: "SQLITE_CORRUPT: database disk image is malformed",
      }),
    );
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const showToast = vi.fn();
    const { result } = renderDataSettingsController({ showToast });

    await waitFor(() => {
      expect(result.current.databaseSizeStatus).toBe("ready");
    });

    await act(async () => {
      await result.current.handleVacuum();
    });

    expect(result.current.databaseRuntimeRecoverySurface).toMatchObject({
      failureKind: "write_corruption",
      mode: "read_only_degraded",
      actions: ["run_integrity_check", "restore_backup"],
    });
    expect(showToast).toHaveBeenCalledWith("data.vacuum_failed");
    expect(consoleWarn).toHaveBeenCalledWith(
      "Database runtime recovery surface detected",
      expect.objectContaining({
        operation: "write",
        failureKind: "write_corruption",
      }),
    );
    consoleWarn.mockRestore();
    consoleError.mockRestore();
  });

  it("reports database size failures separately from loading", async () => {
    vi.mocked(getDatabaseInfo).mockResolvedValue(Result.fail({ type: "UserVisible", message: "db unavailable" }));

    const { result } = renderDataSettingsController();

    await waitFor(() => {
      expect(result.current.databaseSizeStatus).toBe("error");
    });

    expect(result.current.databaseSizeValue).toBe("");
  });

  it("exposes read corruption as runtime recovery surface with diagnostics", async () => {
    vi.mocked(getDatabaseInfo).mockResolvedValue(
      Result.fail({
        type: "UserVisible",
        message: "database disk image is malformed",
      }),
    );
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const { result } = renderDataSettingsController();

    await waitFor(() => {
      expect(result.current.databaseRuntimeRecoverySurface?.failureKind).toBe("read_corruption");
    });

    expect(result.current.databaseRuntimeRecoverySurface).toMatchObject({
      mode: "read_only_degraded",
      actions: ["run_integrity_check", "restore_backup"],
      actionSafety: ["read_only", "requires_explicit_confirmation"],
      diagnosticsIdRequired: true,
    });
    expect(consoleWarn).toHaveBeenCalledWith(
      "Database runtime recovery surface detected",
      expect.objectContaining({
        operation: "read",
        failureKind: "read_corruption",
        mode: "read_only_degraded",
      }),
    );
    consoleWarn.mockRestore();
    consoleError.mockRestore();
  });

  it("does not run vacuum while database size is unavailable", async () => {
    vi.mocked(getDatabaseInfo).mockResolvedValue(Result.fail({ type: "UserVisible", message: "db unavailable" }));
    const { result } = renderDataSettingsController();

    await waitFor(() => {
      expect(result.current.databaseSizeStatus).toBe("error");
    });

    await act(async () => {
      await result.current.handleVacuum();
    });

    expect(vacuumDatabase).not.toHaveBeenCalled();
  });

  it("delegates log directory opening to the native command", async () => {
    const showToast = vi.fn();
    const { result } = renderDataSettingsController({ showToast });

    await act(async () => {
      await result.current.handleOpenLogDir();
    });

    expect(openLogDir).toHaveBeenCalledTimes(1);
    expect(showToast).not.toHaveBeenCalled();
  });

  it("shows non-duplicated copy when opening the log directory fails", async () => {
    vi.mocked(openLogDir).mockResolvedValue(
      Result.fail({
        type: "UserVisible",
        message: "Check OS permissions and try again.",
      }),
    );
    const showToast = vi.fn();
    const { result } = renderHook(() =>
      useDataSettingsController({
        t: ((key: string, options?: { message?: string }) =>
          key === "data.open_log_dir_failed"
            ? `Failed to open log directory: ${options?.message ?? ""}`
            : key) as never,
        showToast,
        setSettingsLoading: vi.fn(),
      }),
    );

    await act(async () => {
      await result.current.handleOpenLogDir();
    });

    expect(showToast).toHaveBeenCalledWith("Failed to open log directory: Check OS permissions and try again.");
    expect(showToast.mock.calls[0]?.[0].match(/Failed to open log directory/g)).toHaveLength(1);
  });

  it("tracks log directory pending state and suppresses duplicate data actions", async () => {
    let resolveOpenLogDir: (() => void) | undefined;
    vi.mocked(openLogDir).mockReturnValue(
      new Promise((resolve) => {
        resolveOpenLogDir = () => resolve(Result.succeed(null));
      }),
    );
    const { result } = renderDataSettingsController();

    await act(async () => {
      void result.current.handleOpenLogDir();
    });

    expect(result.current.openingLogDir).toBe(true);

    await act(async () => {
      void result.current.handleOpenLogDir();
      void result.current.handleVacuum();
    });

    expect(openLogDir).toHaveBeenCalledTimes(1);
    expect(vacuumDatabase).not.toHaveBeenCalled();

    await act(async () => {
      resolveOpenLogDir?.();
    });

    expect(result.current.openingLogDir).toBe(false);
  });

  it("suppresses duplicate vacuum commands from the same render closure", async () => {
    let resolveVacuum: (() => void) | undefined;
    vi.mocked(vacuumDatabase).mockReturnValue(
      new Promise((resolve) => {
        resolveVacuum = () =>
          resolve(
            Result.succeed({
              db_size_bytes: 512,
              wal_size_bytes: 0,
              shm_size_bytes: 0,
              total_size_bytes: 512,
            }),
          );
      }),
    );
    const { result } = renderDataSettingsController();

    await waitFor(() => {
      expect(result.current.databaseSizeStatus).toBe("ready");
    });

    const { handleVacuum } = result.current;

    await act(async () => {
      void handleVacuum();
      void handleVacuum();
    });

    expect(vacuumDatabase).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveVacuum?.();
    });
  });

  it("keeps vacuum action in flight across settings close and reopen", async () => {
    let resolveVacuum: (() => void) | undefined;
    vi.mocked(vacuumDatabase).mockReturnValue(
      new Promise((resolve) => {
        resolveVacuum = () =>
          resolve(
            Result.succeed({
              db_size_bytes: 512,
              wal_size_bytes: 0,
              shm_size_bytes: 0,
              total_size_bytes: 512,
            }),
          );
      }),
    );
    const first = renderDataSettingsController();

    await waitFor(() => {
      expect(first.result.current.databaseSizeStatus).toBe("ready");
    });

    await act(async () => {
      void first.result.current.handleVacuum();
    });

    expect(first.result.current.vacuuming).toBe(true);
    first.unmount();

    const second = renderDataSettingsController();

    expect(second.result.current.vacuuming).toBe(true);

    await act(async () => {
      void second.result.current.handleVacuum();
    });

    expect(vacuumDatabase).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveVacuum?.();
    });

    expect(second.result.current.vacuuming).toBe(false);
  });

  it("refreshes reopened database size after a pending vacuum completes", async () => {
    let resolveFirstDatabaseInfo: ((value: Awaited<ReturnType<typeof getDatabaseInfo>>) => void) | undefined;
    let resolveReopenedDatabaseInfo: ((value: Awaited<ReturnType<typeof getDatabaseInfo>>) => void) | undefined;
    let resolvePostVacuumDatabaseInfo: ((value: Awaited<ReturnType<typeof getDatabaseInfo>>) => void) | undefined;
    let resolveVacuum: (() => void) | undefined;
    vi.mocked(getDatabaseInfo)
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveFirstDatabaseInfo = resolve;
        }),
      )
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveReopenedDatabaseInfo = resolve;
        }),
      )
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolvePostVacuumDatabaseInfo = resolve;
        }),
      );
    vi.mocked(vacuumDatabase).mockReturnValue(
      new Promise((resolve) => {
        resolveVacuum = () =>
          resolve(
            Result.succeed({
              db_size_bytes: 512,
              wal_size_bytes: 0,
              shm_size_bytes: 0,
              total_size_bytes: 512,
            }),
          );
      }),
    );
    const first = renderDataSettingsController();

    await act(async () => {
      resolveFirstDatabaseInfo?.(
        Result.succeed({
          db_size_bytes: 1024,
          wal_size_bytes: 0,
          shm_size_bytes: 0,
          total_size_bytes: 1024,
        }),
      );
    });

    await act(async () => {
      void first.result.current.handleVacuum();
    });

    first.unmount();
    const second = renderDataSettingsController();

    expect(second.result.current.vacuuming).toBe(true);

    await act(async () => {
      resolveReopenedDatabaseInfo?.(
        Result.succeed({
          db_size_bytes: 1024,
          wal_size_bytes: 0,
          shm_size_bytes: 0,
          total_size_bytes: 1024,
        }),
      );
    });

    expect(second.result.current.databaseSizeValue).toBe("1.0 KiB");

    await act(async () => {
      resolveVacuum?.();
    });

    expect(second.result.current.vacuuming).toBe(false);
    expect(getDatabaseInfo).toHaveBeenCalledTimes(3);

    await act(async () => {
      resolvePostVacuumDatabaseInfo?.(
        Result.succeed({
          db_size_bytes: 512,
          wal_size_bytes: 0,
          shm_size_bytes: 0,
          total_size_bytes: 512,
        }),
      );
    });

    expect(second.result.current.databaseSizeValue).toBe("512 B");
  });

  it("does not run vacuum until database size has loaded", async () => {
    let resolveDatabaseInfo: ((value: Awaited<ReturnType<typeof getDatabaseInfo>>) => void) | undefined;
    vi.mocked(getDatabaseInfo).mockReturnValue(
      new Promise((resolve) => {
        resolveDatabaseInfo = resolve;
      }),
    );
    const { result } = renderDataSettingsController();

    await act(async () => {
      await result.current.handleVacuum();
    });

    expect(vacuumDatabase).not.toHaveBeenCalled();
    expect(result.current.databaseSizeStatus).toBe("loading");

    await act(async () => {
      resolveDatabaseInfo?.(
        Result.succeed({
          db_size_bytes: 1024,
          wal_size_bytes: 0,
          shm_size_bytes: 0,
          total_size_bytes: 1024,
        }),
      );
    });

    expect(result.current.databaseSizeStatus).toBe("ready");
    expect(result.current.databaseSizeValue).toBe("1.0 KiB");
  });

  it("suppresses duplicate open log directory commands from the same render closure", async () => {
    let resolveOpenLogDir: (() => void) | undefined;
    vi.mocked(openLogDir).mockReturnValue(
      new Promise((resolve) => {
        resolveOpenLogDir = () => resolve(Result.succeed(null));
      }),
    );
    const { result } = renderDataSettingsController();
    const { handleOpenLogDir } = result.current;

    await act(async () => {
      void handleOpenLogDir();
      void handleOpenLogDir();
    });

    expect(openLogDir).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveOpenLogDir?.();
    });
  });

  it("ignores initial database info resolution after unmount", async () => {
    let resolveDatabaseInfo: ((value: Awaited<ReturnType<typeof getDatabaseInfo>>) => void) | undefined;
    vi.mocked(getDatabaseInfo).mockReturnValue(
      new Promise((resolve) => {
        resolveDatabaseInfo = resolve;
      }),
    );
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { unmount } = renderDataSettingsController();

    unmount();

    await act(async () => {
      resolveDatabaseInfo?.(
        Result.succeed({
          db_size_bytes: 4096,
          wal_size_bytes: 0,
          shm_size_bytes: 0,
          total_size_bytes: 4096,
        }),
      );
    });

    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("ignores initial database info rejection after unmount", async () => {
    let rejectDatabaseInfo: ((error: Error) => void) | undefined;
    vi.mocked(getDatabaseInfo).mockReturnValue(
      new Promise((_, reject) => {
        rejectDatabaseInfo = reject;
      }),
    );
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { unmount } = renderDataSettingsController();

    unmount();

    await act(async () => {
      rejectDatabaseInfo?.(new Error("db transport failed"));
    });

    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("syncs vacuum loading with settings-wide loading while pending across unmount", async () => {
    let resolveVacuum: (() => void) | undefined;
    vi.mocked(vacuumDatabase).mockReturnValue(
      new Promise((resolve) => {
        resolveVacuum = () =>
          resolve(
            Result.succeed({
              db_size_bytes: 512,
              wal_size_bytes: 0,
              shm_size_bytes: 0,
              total_size_bytes: 512,
            }),
          );
      }),
    );
    const setSettingsLoading = vi.fn();
    const { result, unmount } = renderDataSettingsController({
      setSettingsLoading,
    });

    await waitFor(() => {
      expect(result.current.databaseSizeStatus).toBe("ready");
    });

    await act(async () => {
      void result.current.handleVacuum();
    });
    expect(result.current.vacuuming).toBe(true);
    expect(setSettingsLoading).toHaveBeenCalledWith(true);

    unmount();

    expect(setSettingsLoading).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveVacuum?.();
    });

    expect(setSettingsLoading).toHaveBeenLastCalledWith(false);
  });

  it("syncs open log loading with settings-wide loading and suppresses post-unmount errors", async () => {
    let rejectOpenLogDir: ((error: Error) => void) | undefined;
    vi.mocked(openLogDir).mockReturnValue(
      new Promise((_, reject) => {
        rejectOpenLogDir = reject;
      }),
    );
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const setSettingsLoading = vi.fn();
    const showToast = vi.fn();
    const { result, unmount } = renderDataSettingsController({
      setSettingsLoading,
      showToast,
    });

    await act(async () => {
      void result.current.handleOpenLogDir();
    });
    expect(result.current.openingLogDir).toBe(true);
    expect(setSettingsLoading).toHaveBeenCalledWith(true);

    unmount();

    expect(setSettingsLoading).toHaveBeenCalledTimes(1);

    await act(async () => {
      rejectOpenLogDir?.(new Error("open log failed"));
    });

    expect(setSettingsLoading).toHaveBeenLastCalledWith(false);
    expect(showToast).not.toHaveBeenCalled();
    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
