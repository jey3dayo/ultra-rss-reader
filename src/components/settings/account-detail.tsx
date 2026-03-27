import { Result } from "@praha/byethrow";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { deleteAccount, exportOpml, updateAccountSync } from "@/api/tauri-commands";
import { SectionHeading, SettingsRow } from "@/components/settings/settings-components";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useAccounts } from "@/hooks/use-accounts";
import { useUiStore } from "@/stores/ui-store";

export function AccountDetail() {
  const settingsAccountId = useUiStore((s) => s.settingsAccountId);
  const setSettingsAccountId = useUiStore((s) => s.setSettingsAccountId);
  const { data: accounts } = useAccounts();
  const qc = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const account = accounts?.find((a) => a.id === settingsAccountId);

  if (!account) return null;

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
      Result.inspectError((e) => useUiStore.getState().showToast(`Failed to update sync settings: ${e.message}`)),
      Result.inspect(() => qc.invalidateQueries({ queryKey: ["accounts"] })),
    );
  };

  const handleExportOpml = async () => {
    Result.pipe(
      await exportOpml(account.id),
      Result.inspectError((e) => useUiStore.getState().showToast(`Failed to export OPML: ${e.message}`)),
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
      Result.inspectError((e) => useUiStore.getState().showToast(`Failed to delete account: ${e.message}`)),
      Result.inspect(() => {
        qc.invalidateQueries({ queryKey: ["accounts"] });
        qc.invalidateQueries({ queryKey: ["feeds"] });
        setSettingsAccountId(null);
      }),
    );
  };

  return (
    <div className="p-6">
      <h2 className="mb-2 text-center text-lg font-semibold">{account.name}</h2>
      <p className="mb-6 text-center text-sm text-muted-foreground">{account.kind}</p>

      <section className="mb-6">
        <SectionHeading>General</SectionHeading>
        <SettingsRow label="Description" value={account.name} type="text" />
        <SettingsRow
          label="Type"
          value={account.kind === "FreshRss" ? "FreshRSS" : account.kind === "Inoreader" ? "Inoreader" : "Local"}
          type="text"
        />
        {account.kind === "Inoreader" && <SettingsRow label="Server" value="inoreader.com" type="text" />}
      </section>

      <section className="mb-6">
        <SectionHeading>Syncing</SectionHeading>
        <div className="flex min-h-[44px] items-center justify-between border-b border-border py-3">
          <span className="text-sm text-foreground">Sync</span>
          <select
            name="sync-interval"
            value={String(account.sync_interval_secs)}
            onChange={(e) => handleSyncUpdate({ syncIntervalSecs: Number(e.target.value) })}
            className="rounded-md border border-border bg-background px-2 py-1 text-sm text-muted-foreground"
          >
            <option value="900">Every 15 minutes</option>
            <option value="1800">Every 30 minutes</option>
            <option value="3600">Every hour</option>
            <option value="7200">Every 2 hours</option>
            <option value="14400">Every 4 hours</option>
            <option value="86400">Once a day</option>
          </select>
        </div>
        <div className="flex min-h-[44px] items-center justify-between border-b border-border py-3">
          <span className="text-sm text-foreground">Sync on wake up from sleep</span>
          <Switch
            checked={account.sync_on_wake}
            onCheckedChange={(v) => handleSyncUpdate({ syncOnWake: v })}
            className="data-[state=checked]:bg-accent"
          />
        </div>
        <div className="flex min-h-[44px] items-center justify-between border-b border-border py-3">
          <span className="text-sm text-foreground">Keep read items</span>
          <select
            name="keep-read-items"
            value={String(account.keep_read_items_days)}
            onChange={(e) => handleSyncUpdate({ keepReadItemsDays: Number(e.target.value) })}
            className="rounded-md border border-border bg-background px-2 py-1 text-sm text-muted-foreground"
          >
            <option value="7">1 week</option>
            <option value="14">2 weeks</option>
            <option value="30">1 month</option>
            <option value="90">3 months</option>
            <option value="180">6 months</option>
            <option value="365">1 year</option>
            <option value="0">Forever</option>
          </select>
        </div>
      </section>

      <div className="mt-6 border-t border-border pt-6">
        <Button variant="link" onClick={handleExportOpml} className="mb-4 h-auto p-0 text-sm text-foreground">
          Export OPML
        </Button>
      </div>

      <div className="mt-2 border-t border-border pt-6">
        {!confirmDelete ? (
          <Button variant="link" onClick={() => setConfirmDelete(true)} className="h-auto p-0 text-sm text-destructive">
            Delete Account
          </Button>
        ) : (
          <div className="flex items-center gap-3">
            <span className="text-sm text-destructive">Delete this account?</span>
            <Button variant="destructive" size="sm" onClick={handleDelete}>
              Delete
            </Button>
            <Button variant="outline" size="sm" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
