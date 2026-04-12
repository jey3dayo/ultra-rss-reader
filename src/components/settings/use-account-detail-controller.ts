import { Result } from "@praha/byethrow";
import { useQueryClient } from "@tanstack/react-query";
import type { TFunction } from "i18next";
import { type KeyboardEvent, useRef, useState } from "react";
import type { AccountDto } from "@/api/tauri-commands";
import {
  copyToClipboard,
  deleteAccount,
  exportOpml,
  renameAccount,
  syncAccount,
  testAccountConnection,
  updateAccountCredentials,
  updateAccountSync,
} from "@/api/tauri-commands";
import { useUiStore } from "@/stores/ui-store";

type Account = NonNullable<AccountDto | undefined>;

type UpdateSyncParams = {
  syncIntervalSecs?: number;
  syncOnWake?: boolean;
  keepReadItemsDays?: number;
};

type UseAccountDetailControllerParams = {
  account: Account;
  t: TFunction<"settings">;
  onAccountDeleted: () => void;
};

export function useAccountDetailController({ account, t, onAccountDeleted }: UseAccountDetailControllerParams) {
  const qc = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [credServerUrl, setCredServerUrl] = useState<string | null>(null);
  const [credUsername, setCredUsername] = useState<string | null>(null);
  const [credPassword, setCredPassword] = useState<string | null>(null);
  const [testingConnection, setTestingConnection] = useState(false);
  const pendingCredentialSaveRef = useRef<Promise<boolean> | null>(null);

  const startEditingName = () => {
    setNameDraft(account.name);
    setEditingName(true);
    requestAnimationFrame(() => {
      nameInputRef.current?.focus();
      nameInputRef.current?.select();
    });
  };

  const commitRename = async () => {
    const trimmed = nameDraft.trim();
    if (!trimmed || trimmed === account.name) {
      setNameDraft(account.name);
      setEditingName(false);
      return;
    }

    setSavingName(true);
    let renameSucceeded = false;
    Result.pipe(
      await renameAccount(account.id, trimmed),
      Result.inspectError((e) =>
        useUiStore.getState().showToast(t("account.failed_to_rename", { message: e.message })),
      ),
      Result.inspect((updated) => {
        renameSucceeded = true;
        setNameDraft(updated.name);
        qc.setQueryData<AccountDto[]>(["accounts"], (prev) => prev?.map((a) => (a.id === updated.id ? updated : a)));
        qc.invalidateQueries({ queryKey: ["accounts"] });
      }),
    );
    setSavingName(false);
    if (renameSucceeded) {
      setEditingName(false);
    }
  };

  const handleNameKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      void commitRename();
    } else if (e.key === "Escape") {
      setEditingName(false);
    }
  };

  const handleSyncUpdate = async (partial: UpdateSyncParams) => {
    Result.pipe(
      await updateAccountSync(
        account.id,
        partial.syncIntervalSecs ?? account.sync_interval_secs,
        partial.syncOnWake ?? account.sync_on_wake,
        partial.keepReadItemsDays ?? account.keep_read_items_days,
      ),
      Result.inspectError((e) =>
        useUiStore.getState().showToast(t("account.failed_to_update_sync", { message: e.message })),
      ),
      Result.inspect((updated) => {
        qc.setQueryData<AccountDto[]>(["accounts"], (prev) => prev?.map((a) => (a.id === updated.id ? updated : a)));
      }),
    );
  };

  const commitCredentials = async (): Promise<boolean> => {
    if (pendingCredentialSaveRef.current) {
      return pendingCredentialSaveRef.current;
    }

    const saveTask = (async () => {
      const serverUrl = credServerUrl ?? account.server_url ?? undefined;
      const username = credUsername ?? account.username ?? undefined;
      const password = credPassword || undefined;
      const serverUrlChanged = credServerUrl !== null && credServerUrl !== (account.server_url ?? "");
      const usernameChanged = credUsername !== null && credUsername !== (account.username ?? "");
      const passwordChanged = credPassword !== null && credPassword !== "";

      if (!serverUrlChanged && !usernameChanged && !passwordChanged) {
        setCredPassword(null);
        return true;
      }

      let saved = false;
      Result.pipe(
        await updateAccountCredentials(account.id, serverUrl, username, password),
        Result.inspectError((e) =>
          useUiStore.getState().showToast(t("account.failed_to_update_sync", { message: e.message })),
        ),
        Result.inspect((updated) => {
          saved = true;
          qc.setQueryData<AccountDto[]>(["accounts"], (prev) => prev?.map((a) => (a.id === updated.id ? updated : a)));
          setCredServerUrl(null);
          setCredUsername(null);
          setCredPassword(null);
          useUiStore.getState().showToast(t("account.credentials_saved"));
        }),
      );

      return saved;
    })();

    pendingCredentialSaveRef.current = saveTask.finally(() => {
      pendingCredentialSaveRef.current = null;
    });

    return pendingCredentialSaveRef.current;
  };

  const handleTestConnection = async () => {
    setTestingConnection(true);
    try {
      const credentialsSaved = await commitCredentials();
      if (!credentialsSaved) return;

      const result = await testAccountConnection(account.id);
      Result.pipe(
        result,
        Result.inspectError((e) => {
          useUiStore.getState().showToast(t("account.connection_failed", { message: e.message }));
        }),
        Result.inspect(() => {
          useUiStore.getState().showToast(t("account.connection_success"));
        }),
      );
    } finally {
      setTestingConnection(false);
    }
  };

  const handleSyncNow = async () => {
    const result = await syncAccount(account.id);
    Result.pipe(
      result,
      Result.inspect((syncResult) => {
        qc.invalidateQueries({ queryKey: ["feeds"] });
        qc.invalidateQueries({ queryKey: ["articles"] });
        if (syncResult.failed.length > 0) {
          const names = syncResult.failed.map((f) => f.account_name).join(", ");
          useUiStore.getState().showToast(t("account.sync_failed", { message: names }));
        } else if (syncResult.warnings.length > 0) {
          useUiStore.getState().showToast(t("account.sync_completed_with_warnings"));
        } else {
          useUiStore.getState().showToast(t("account.sync_complete"));
        }
      }),
      Result.inspectError((e) => {
        useUiStore.getState().showToast(t("account.sync_failed", { message: e.message }));
      }),
    );
  };

  const handleExportOpml = async () => {
    Result.pipe(
      await exportOpml(account.id),
      Result.inspectError((e) =>
        useUiStore.getState().showToast(t("account.failed_to_export_opml", { message: e.message })),
      ),
      Result.inspect((opmlString) => {
        const blob = new Blob([opmlString], { type: "application/xml" });
        const url = URL.createObjectURL(blob);
        const safeName = account.name.replace(/[<>:"/\\|?*]/g, "_");
        const a = document.createElement("a");
        a.href = url;
        a.download = `${safeName}-feeds.opml`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }),
    );
  };

  const handleDelete = async () => {
    Result.pipe(
      await deleteAccount(account.id),
      Result.inspectError((e) =>
        useUiStore.getState().showToast(t("account.failed_to_delete", { message: e.message })),
      ),
      Result.inspect(() => {
        qc.invalidateQueries({ queryKey: ["accounts"] });
        qc.invalidateQueries({ queryKey: ["feeds"] });
        onAccountDeleted();
      }),
    );
  };

  const handleCopyServerUrl = async () => {
    const value = credServerUrl ?? account.server_url ?? "";
    if (!value) return;

    Result.pipe(
      await copyToClipboard(value),
      Result.inspect(() => {
        useUiStore.getState().showToast(t("account.copied_to_clipboard"));
      }),
      Result.inspectError((e) => {
        useUiStore.getState().showToast(e.message);
      }),
    );
  };

  const onPasswordFocus = () => {
    if (credPassword === null) setCredPassword("");
  };

  const syncIntervalOptions = [
    { value: "900", label: t("account.every_15_minutes") },
    { value: "1800", label: t("account.every_30_minutes") },
    { value: "3600", label: t("account.every_hour") },
    { value: "7200", label: t("account.every_2_hours") },
    { value: "14400", label: t("account.every_4_hours") },
    { value: "86400", label: t("account.once_a_day") },
  ];
  const keepReadItemsOptions = [
    { value: "7", label: t("account.one_week") },
    { value: "14", label: t("account.two_weeks") },
    { value: "30", label: t("account.one_month") },
    { value: "60", label: t("account.sixty_days") },
    { value: "90", label: t("account.three_months") },
    { value: "180", label: t("account.six_months") },
    { value: "365", label: t("account.one_year") },
    { value: "0", label: t("account.forever") },
  ];

  return {
    confirmDelete,
    setConfirmDelete,
    editingName,
    savingName,
    nameDraft,
    setNameDraft,
    nameInputRef,
    credServerUrl,
    credUsername,
    credPassword,
    testingConnection,
    setCredServerUrl,
    setCredUsername,
    setCredPassword,
    startEditingName,
    commitRename,
    commitCredentials,
    handleNameKeyDown,
    handleSyncUpdate,
    handleTestConnection,
    handleSyncNow,
    handleExportOpml,
    handleDelete,
    handleCopyServerUrl,
    onPasswordFocus,
    syncIntervalOptions,
    keepReadItemsOptions,
  } as const;
}
