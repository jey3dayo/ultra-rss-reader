import { Result } from "@praha/byethrow";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { deleteAccount, exportOpml } from "@/api/tauri-commands";
import { SectionHeading, SettingsRow } from "@/components/settings/settings-components";
import { Button } from "@/components/ui/button";
import { useAccounts } from "@/hooks/use-accounts";
import { useUiStore } from "@/stores/ui-store";

export function AccountDetail() {
  const { settingsAccountId, setSettingsAccountId } = useUiStore();
  const { data: accounts } = useAccounts();
  const qc = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const account = accounts?.find((a) => a.id === settingsAccountId);

  if (!account) return null;

  const handleExportOpml = async () => {
    Result.pipe(
      await exportOpml(account.id),
      Result.inspectError((e) => window.alert(`Failed to export OPML: ${e.message}`)),
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
      Result.inspectError((e) => window.alert(`Failed to delete account: ${e.message}`)),
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
        <SettingsRow label="Sync" value="Every hour" type="select" />
        <SettingsRow label="Sync on wake up from sleep" type="switch" checked={true} />
        <SettingsRow label="Keep read items" value="1 month" type="select" />
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
