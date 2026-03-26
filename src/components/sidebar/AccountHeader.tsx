import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { addLocalFeed } from "../../api/tauri-commands";
import { useAccounts } from "../../hooks/use-accounts";
import { AddAccountDialog } from "../AddAccountDialog";

export function AccountHeader() {
  const [showAddAccount, setShowAddAccount] = useState(false);
  const { data: accounts } = useAccounts();
  const qc = useQueryClient();

  const handleAddFeed = async () => {
    const url = window.prompt("Enter feed URL:");
    if (!url) return;

    const firstAccount = accounts?.[0];
    if (!firstAccount) {
      window.alert("Please add an account first.");
      return;
    }

    try {
      await addLocalFeed(firstAccount.id, url);
      qc.invalidateQueries({ queryKey: ["feeds"] });
    } catch (e) {
      window.alert(`Failed to add feed: ${e}`);
    }
  };

  return (
    <>
      <div
        style={{
          padding: "var(--space-lg) var(--space-lg) var(--space-sm)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <div style={{ fontSize: "var(--font-size-xl)", fontWeight: "bold" }}>Ultra RSS</div>
          <div style={{ fontSize: "var(--font-size-xs)", color: "var(--text-muted)" }}>Today</div>
        </div>
        <div style={{ display: "flex", gap: "var(--space-sm)" }}>
          <button
            type="button"
            onClick={handleAddFeed}
            title="Add Feed"
            style={{
              background: "none",
              border: "none",
              color: "var(--text-tertiary)",
              cursor: "pointer",
              fontSize: "16px",
            }}
          >
            +
          </button>
          <button
            type="button"
            onClick={() => setShowAddAccount(true)}
            title="Add Account"
            style={{
              background: "none",
              border: "none",
              color: "var(--text-tertiary)",
              cursor: "pointer",
              fontSize: "16px",
            }}
          >
            &#9881;
          </button>
        </div>
      </div>
      <AddAccountDialog open={showAddAccount} onClose={() => setShowAddAccount(false)} />
    </>
  );
}
