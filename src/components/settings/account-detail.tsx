import { Result } from "@praha/byethrow";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { deleteAccount, exportOpml } from "@/api/tauri-commands";
import { SectionHeading, SettingsRow } from "@/components/settings/settings-components";
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
        const a = document.createElement("a");
        a.href = url;
        a.download = `${account.name}-feeds.opml`;
        a.click();
        URL.revokeObjectURL(url);
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
        <SettingsRow label="Type" value={account.kind === "FreshRss" ? "FreshRSS" : "Local"} type="text" />
      </section>

      <section className="mb-6">
        <SectionHeading>Syncing</SectionHeading>
        <SettingsRow label="Sync" value="Every hour" type="select" />
        <SettingsRow label="Sync on wake up from sleep" type="switch" checked={true} />
        <SettingsRow label="Keep read items" value="1 month" type="select" />
      </section>

      <div className="mt-6 border-t border-border pt-6">
        <button type="button" onClick={handleExportOpml} className="mb-4 text-sm text-foreground hover:underline">
          Export OPML
        </button>
      </div>

      <div className="mt-2 border-t border-border pt-6">
        {!confirmDelete ? (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="text-sm text-destructive hover:underline"
          >
            Delete Account
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <span className="text-sm text-destructive">Delete this account?</span>
            <button
              type="button"
              onClick={handleDelete}
              className="rounded-md bg-destructive px-3 py-1.5 text-sm text-white"
            >
              Delete
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="rounded-md border border-border px-3 py-1.5 text-sm text-foreground"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
