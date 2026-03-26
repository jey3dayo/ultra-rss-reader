import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Result } from "@praha/byethrow";
import { deleteAccount } from "../../api/tauri-commands";
import { useAccounts } from "../../hooks/use-accounts";
import { useUiStore } from "../../stores/ui-store";
import { SettingsRow } from "./SettingsRow";
import { SettingsSection } from "./SettingsSection";

export function AccountDetail() {
  const { settingsAccountId, setSettingsAccountId } = useUiStore();
  const { data: accounts } = useAccounts();
  const qc = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const account = accounts?.find((a) => a.id === settingsAccountId);

  if (!account) return null;

  const handleDelete = async () => {
    const result = await deleteAccount(account.id);
    if (Result.isFailure(result)) {
      window.alert(`Failed to delete account: ${result.error.message}`);
      return;
    }
    qc.invalidateQueries({ queryKey: ["accounts"] });
    qc.invalidateQueries({ queryKey: ["feeds"] });
    setSettingsAccountId(null);
  };

  return (
    <div style={{ padding: "var(--space-lg) 0" }}>
      {/* Account header */}
      <div style={{ padding: "0 var(--space-xl)", marginBottom: "var(--space-sm)" }}>
        <div style={{ fontSize: "var(--font-size-xl)", fontWeight: "bold", color: "var(--text-primary)" }}>
          {account.name}
        </div>
        <div style={{ fontSize: "var(--font-size-sm)", color: "var(--text-muted)" }}>
          {account.kind === "FreshRss" ? "FreshRSS" : "Local"}
        </div>
      </div>

      {/* General section */}
      <SettingsSection title="General">
        <SettingsRow label="Description">{account.name}</SettingsRow>
        <SettingsRow label="Type">{account.kind === "FreshRss" ? "FreshRSS" : "Local"}</SettingsRow>
      </SettingsSection>

      {/* Syncing section */}
      <SettingsSection title="Syncing">
        <SettingsRow label="Sync">Every hour</SettingsRow>
        <SettingsRow label="Sync on wake">On</SettingsRow>
        <SettingsRow label="Keep read items">1 month</SettingsRow>
      </SettingsSection>

      {/* Delete account */}
      <div style={{ padding: "var(--space-xl) var(--space-xl) 0" }}>
        {!confirmDelete ? (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            style={{
              background: "none",
              border: "none",
              color: "#ff5555",
              fontSize: "var(--font-size-md)",
              cursor: "pointer",
              padding: 0,
            }}
          >
            &#8854; Delete Account
          </button>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-md)" }}>
            <span style={{ color: "#ff5555", fontSize: "var(--font-size-md)" }}>Delete this account?</span>
            <button
              type="button"
              onClick={handleDelete}
              style={{
                background: "#ff5555",
                border: "none",
                color: "#fff",
                padding: "var(--space-xs) var(--space-md)",
                borderRadius: 6,
                cursor: "pointer",
                fontSize: "var(--font-size-sm)",
              }}
            >
              Delete
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              style={{
                background: "none",
                border: "1px solid var(--border-subtle)",
                color: "var(--text-secondary)",
                padding: "var(--space-xs) var(--space-md)",
                borderRadius: 6,
                cursor: "pointer",
                fontSize: "var(--font-size-sm)",
              }}
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
