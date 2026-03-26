import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Result } from "@praha/byethrow";
import { deleteAccount } from "../../api/tauri-commands";
import { useAccounts } from "../../hooks/use-accounts";
import { useUiStore } from "../../stores/ui-store";

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
    <div style={{ padding: "var(--space-xl)" }}>
      <button
        type="button"
        onClick={() => setSettingsAccountId(null)}
        style={{
          background: "none",
          border: "none",
          color: "var(--accent-blue)",
          fontSize: "var(--font-size-md)",
          cursor: "pointer",
          padding: 0,
          marginBottom: "var(--space-lg)",
        }}
      >
        &larr; Accounts
      </button>

      <div style={{ marginBottom: "var(--space-xl)" }}>
        <div style={{ fontSize: "var(--font-size-xl)", fontWeight: "bold", color: "var(--text-primary)" }}>
          {account.name}
        </div>
        <div style={{ fontSize: "var(--font-size-sm)", color: "var(--text-muted)" }}>{account.kind}</div>
      </div>

      {/* General section */}
      <div
        style={{
          fontSize: "var(--font-size-xs)",
          color: "var(--text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          marginBottom: "var(--space-sm)",
        }}
      >
        General
      </div>
      <div style={{ marginBottom: "var(--space-xl)" }}>
        <SettingsRow label="Name" value={account.name} />
        <SettingsRow label="Type" value={account.kind === "FreshRss" ? "FreshRSS" : "Local"} />
      </div>

      {/* Syncing section */}
      <div
        style={{
          fontSize: "var(--font-size-xs)",
          color: "var(--text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          marginBottom: "var(--space-sm)",
        }}
      >
        Syncing
      </div>
      <div style={{ marginBottom: "var(--space-xl)" }}>
        <SettingsRow label="Sync" value="Every hour" />
        <SettingsRow label="Sync on wake" value="On" />
        <SettingsRow label="Keep read items" value="1 month" />
      </div>

      {/* Delete account */}
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
  );
}

function SettingsRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        padding: "var(--space-sm) 0",
        fontSize: "var(--font-size-md)",
        borderBottom: "1px solid var(--border-divider)",
      }}
    >
      <span style={{ color: "var(--text-tertiary)" }}>{label}</span>
      <span style={{ color: "var(--text-secondary)" }}>{value}</span>
    </div>
  );
}
