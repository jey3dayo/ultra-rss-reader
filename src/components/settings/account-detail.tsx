import { Result } from "@praha/byethrow";
import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { AccountDto } from "@/api/tauri-commands";
import {
  deleteAccount,
  exportOpml,
  renameAccount,
  updateAccountCredentials,
  updateAccountSync,
} from "@/api/tauri-commands";
import { AccountCredentialsSectionView } from "@/components/settings/account-credentials-section-view";
import { AccountDetailView } from "@/components/settings/account-detail-view";
import { useAccounts } from "@/hooks/use-accounts";
import { useUiStore } from "@/stores/ui-store";

export function AccountDetail() {
  const { t } = useTranslation("settings");
  const { t: tc } = useTranslation("common");
  const settingsAccountId = useUiStore((s) => s.settingsAccountId);
  const setSettingsAccountId = useUiStore((s) => s.setSettingsAccountId);
  const { data: accounts } = useAccounts();
  const qc = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [credServerUrl, setCredServerUrl] = useState<string | null>(null);
  const [credUsername, setCredUsername] = useState<string | null>(null);
  const [credPassword, setCredPassword] = useState("");

  const account = accounts?.find((a) => a.id === settingsAccountId);

  if (!account) return null;

  const startEditingName = () => {
    setNameDraft(account.name);
    setEditingName(true);
    // Focus the input after render
    requestAnimationFrame(() => nameInputRef.current?.focus());
  };

  const commitRename = async () => {
    const trimmed = nameDraft.trim();
    if (!trimmed || trimmed === account.name) {
      setEditingName(false);
      return;
    }
    Result.pipe(
      await renameAccount(account.id, trimmed),
      Result.inspectError((e) =>
        useUiStore.getState().showToast(t("account.failed_to_rename", { message: e.message })),
      ),
      Result.inspect((updated) => {
        qc.setQueryData<AccountDto[]>(["accounts"], (prev) => prev?.map((a) => (a.id === updated.id ? updated : a)));
      }),
    );
    setEditingName(false);
  };

  const handleNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commitRename();
    } else if (e.key === "Escape") {
      setEditingName(false);
    }
  };

  const handleSyncUpdate = async (partial: {
    syncIntervalSecs?: number;
    syncOnWake?: boolean;
    keepReadItemsDays?: number;
  }) => {
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
        // Immediately update cache with returned DTO to prevent race conditions
        qc.setQueryData<AccountDto[]>(["accounts"], (prev) => prev?.map((a) => (a.id === updated.id ? updated : a)));
      }),
    );
  };

  const requiresCredentials = account.kind === "FreshRss" || account.kind === "Inoreader";

  const commitCredentials = async () => {
    const serverUrl = credServerUrl ?? account.server_url ?? undefined;
    const username = credUsername ?? account.username ?? undefined;
    const password = credPassword || undefined;

    // Only update if something actually changed
    const serverUrlChanged = credServerUrl !== null && credServerUrl !== (account.server_url ?? "");
    const usernameChanged = credUsername !== null && credUsername !== (account.username ?? "");
    const passwordChanged = credPassword !== "";

    if (!serverUrlChanged && !usernameChanged && !passwordChanged) return;

    Result.pipe(
      await updateAccountCredentials(account.id, serverUrl, username, password),
      Result.inspectError((e) =>
        useUiStore.getState().showToast(t("account.failed_to_update_sync", { message: e.message })),
      ),
      Result.inspect((updated) => {
        qc.setQueryData<AccountDto[]>(["accounts"], (prev) => prev?.map((a) => (a.id === updated.id ? updated : a)));
        setCredServerUrl(null);
        setCredUsername(null);
        setCredPassword("");
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
        setSettingsAccountId(null);
      }),
    );
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
    { value: "90", label: t("account.three_months") },
    { value: "180", label: t("account.six_months") },
    { value: "365", label: t("account.one_year") },
    { value: "0", label: t("account.forever") },
  ];
  return (
    <AccountDetailView
      title={account.name}
      subtitle={account.kind}
      generalSection={{
        heading: t("account.general"),
        nameLabel: t("account.description"),
        nameValue: account.name,
        editNameTitle: t("account.click_to_edit"),
        isEditingName: editingName,
        nameDraft,
        nameInputRef,
        infoRows: [
          {
            label: t("account.type"),
            value:
              account.kind === "FreshRss"
                ? t("account.freshrss")
                : account.kind === "Inoreader"
                  ? t("account.inoreader")
                  : t("account.local"),
          },
        ],
        onStartEditingName: startEditingName,
        onNameDraftChange: setNameDraft,
        onCommitName: commitRename,
        onNameKeyDown: handleNameKeyDown,
      }}
      credentialsSection={
        requiresCredentials ? (
          <AccountCredentialsSectionView
            heading={account.kind === "FreshRss" ? "SERVER" : t("account.credentials")}
            serverUrlLabel={account.kind === "FreshRss" ? t("account.server_url") : undefined}
            serverUrlValue={credServerUrl ?? account.server_url ?? ""}
            serverUrlPlaceholder={t("account.server_url_placeholder")}
            onServerUrlChange={account.kind === "FreshRss" ? setCredServerUrl : undefined}
            onServerUrlBlur={commitCredentials}
            usernameLabel={t("account.username")}
            usernameValue={credUsername ?? account.username ?? ""}
            onUsernameChange={setCredUsername}
            onUsernameBlur={commitCredentials}
            passwordLabel={t("account.password")}
            passwordValue={credPassword}
            passwordPlaceholder={t("account.password_placeholder")}
            onPasswordChange={setCredPassword}
            onPasswordBlur={commitCredentials}
          />
        ) : undefined
      }
      syncSection={{
        heading: t("account.syncing"),
        syncInterval: {
          name: "sync-interval",
          label: t("account.sync"),
          value: String(account.sync_interval_secs),
          options: syncIntervalOptions,
          onChange: (value) => handleSyncUpdate({ syncIntervalSecs: Number(value) }),
        },
        syncOnWake: {
          label: t("account.sync_on_wake"),
          checked: account.sync_on_wake,
          onChange: (value) => handleSyncUpdate({ syncOnWake: value }),
        },
        keepReadItems: {
          name: "keep-read-items",
          label: t("account.keep_read_items"),
          value: String(account.keep_read_items_days),
          options: keepReadItemsOptions,
          onChange: (value) => handleSyncUpdate({ keepReadItemsDays: Number(value) }),
        },
      }}
      dangerZone={{
        exportLabel: t("account.export_opml"),
        deleteLabel: !confirmDelete ? t("account.delete_account") : tc("delete"),
        cancelLabel: tc("cancel"),
        confirmDeleteLabel: t("account.confirm_delete"),
        isConfirmingDelete: confirmDelete,
        onExport: handleExportOpml,
        onRequestDelete: () => setConfirmDelete(true),
        onConfirmDelete: handleDelete,
        onCancelDelete: () => setConfirmDelete(false),
      }}
    />
  );
}
