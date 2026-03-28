import { Result } from "@praha/byethrow";
import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { AccountDto } from "@/api/tauri-commands";
import { deleteAccount, exportOpml, renameAccount, updateAccountSync } from "@/api/tauri-commands";
import { SectionHeading, SettingsRow, SettingsSelect } from "@/components/settings/settings-components";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
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

  const sortSubscriptionsOptions = [
    { value: "folders_first", label: t("account.folders_first") },
    { value: "alphabetical", label: t("account.alphabetical") },
    { value: "newest_first", label: t("account.newest_first") },
    { value: "oldest_first", label: t("account.oldest_first") },
  ];

  const markAsReadOptions = [
    { value: "on_open", label: t("account.on_open") },
    { value: "manual", label: t("account.manual") },
  ];

  return (
    <div className="p-6">
      <h2 className="mb-2 text-center text-lg font-semibold">{account.name}</h2>
      <p className="mb-6 text-center text-sm text-muted-foreground">{account.kind}</p>

      <section className="mb-6">
        <SectionHeading>{t("account.general")}</SectionHeading>
        <div className="flex min-h-[44px] items-center justify-between border-b border-border py-3">
          <span className="text-sm text-foreground">{t("account.description")}</span>
          {editingName ? (
            <input
              ref={nameInputRef}
              type="text"
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onBlur={commitRename}
              onKeyDown={handleNameKeyDown}
              className="rounded-md border border-border bg-background px-2 py-1 text-right text-sm text-muted-foreground outline-none focus:border-accent"
            />
          ) : (
            <button
              type="button"
              onClick={startEditingName}
              className="cursor-pointer text-sm text-muted-foreground hover:text-foreground"
              title={t("account.click_to_edit")}
            >
              {account.name}
            </button>
          )}
        </div>
        <SettingsRow
          label={t("account.type")}
          value={
            account.kind === "FreshRss"
              ? t("account.freshrss")
              : account.kind === "Inoreader"
                ? t("account.inoreader")
                : t("account.local")
          }
          type="text"
        />
        {account.kind === "Inoreader" && (
          <SettingsRow label={t("account.server")} value={t("account.inoreader_server")} type="text" />
        )}
        {account.kind === "FreshRss" && account.server_url && (
          <SettingsRow label={t("account.server")} value={account.server_url} type="text" truncate />
        )}
      </section>

      <section className="mb-6">
        <SectionHeading>{t("account.syncing")}</SectionHeading>
        <div className="flex min-h-[44px] items-center justify-between border-b border-border py-3">
          <span className="text-sm text-foreground">{t("account.sync")}</span>
          <select
            name="sync-interval"
            value={String(account.sync_interval_secs)}
            onChange={(e) => handleSyncUpdate({ syncIntervalSecs: Number(e.target.value) })}
            className="rounded-md border border-border bg-background px-2 py-1 text-sm text-muted-foreground"
          >
            <option value="900">{t("account.every_15_minutes")}</option>
            <option value="1800">{t("account.every_30_minutes")}</option>
            <option value="3600">{t("account.every_hour")}</option>
            <option value="7200">{t("account.every_2_hours")}</option>
            <option value="14400">{t("account.every_4_hours")}</option>
            <option value="86400">{t("account.once_a_day")}</option>
          </select>
        </div>
        <div className="flex min-h-[44px] items-center justify-between border-b border-border py-3">
          <span className="text-sm text-foreground">{t("account.sync_on_wake")}</span>
          <Switch
            checked={account.sync_on_wake}
            onCheckedChange={(v) => handleSyncUpdate({ syncOnWake: v })}
            className="data-[state=checked]:bg-accent"
          />
        </div>
        <div className="flex min-h-[44px] items-center justify-between border-b border-border py-3">
          <span className="text-sm text-foreground">{t("account.keep_read_items")}</span>
          <select
            name="keep-read-items"
            value={String(account.keep_read_items_days)}
            onChange={(e) => handleSyncUpdate({ keepReadItemsDays: Number(e.target.value) })}
            className="rounded-md border border-border bg-background px-2 py-1 text-sm text-muted-foreground"
          >
            <option value="7">{t("account.one_week")}</option>
            <option value="14">{t("account.two_weeks")}</option>
            <option value="30">{t("account.one_month")}</option>
            <option value="90">{t("account.three_months")}</option>
            <option value="180">{t("account.six_months")}</option>
            <option value="365">{t("account.one_year")}</option>
            <option value="0">{t("account.forever")}</option>
          </select>
        </div>
      </section>

      {/* TODO: sort_subscriptions and mark_article_as_read are persisted but not yet
           wired to runtime behavior. Wire sidebar sort and article-view read-on-open
           to these keys when implementing account-level reading preferences. */}
      <section className="mb-6">
        <SectionHeading>
          {t("account.reading")}{" "}
          <span className="text-xs font-normal text-muted-foreground">{t("account.applies_to_all")}</span>
        </SectionHeading>
        <SettingsSelect
          label={t("account.sort_subscriptions")}
          prefKey="sort_subscriptions"
          options={sortSubscriptionsOptions}
        />
        <SettingsSelect
          label={t("account.mark_article_as_read")}
          prefKey="mark_article_as_read"
          options={markAsReadOptions}
        />
      </section>

      <div className="mt-6 border-t border-border pt-6">
        <Button variant="outline" onClick={handleExportOpml} className="text-sm">
          {t("account.export_opml")}
        </Button>
      </div>

      <div className="mt-2 border-t border-border pt-6">
        {!confirmDelete ? (
          <Button variant="destructive" onClick={() => setConfirmDelete(true)} className="text-sm">
            {t("account.delete_account")}
          </Button>
        ) : (
          <div className="flex items-center gap-3">
            <span className="text-sm text-destructive">{t("account.confirm_delete")}</span>
            <Button variant="destructive" size="sm" onClick={handleDelete}>
              {tc("delete")}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setConfirmDelete(false)}>
              {tc("cancel")}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
