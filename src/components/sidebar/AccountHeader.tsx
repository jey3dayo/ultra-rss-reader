import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Result } from "@praha/byethrow";
import { addLocalFeed } from "../../api/tauri-commands";
import { useAccounts } from "../../hooks/use-accounts";
import { useUiStore } from "../../stores/ui-store";
import { AddAccountDialog } from "../AddAccountDialog";
import { IconButton } from "../IconButton";

export function AccountHeader() {
  const [showAddAccount, setShowAddAccount] = useState(false);
  const { data: accounts } = useAccounts();
  const { selectedAccountId } = useUiStore();
  const qc = useQueryClient();

  const selectedAccount = accounts?.find((a) => a.id === selectedAccountId);

  const handleAddFeed = async () => {
    if (!selectedAccountId) {
      window.alert("Please add an account first.");
      return;
    }
    const url = window.prompt("Enter feed URL:");
    if (!url) return;

    console.log("[AddFeed] adding:", { accountId: selectedAccountId, url });
    const result = await addLocalFeed(selectedAccountId, url);
    if (Result.isFailure(result)) {
      console.error("[AddFeed] failed:", result.error);
      window.alert(`Failed to add feed: ${result.error.message}`);
      return;
    }
    console.log("[AddFeed] success:", result.value);
    qc.invalidateQueries({ queryKey: ["feeds"] });
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
          <div style={{ fontSize: "var(--font-size-xl)", fontWeight: "bold" }}>
            {selectedAccount?.name ?? "Ultra RSS"}
          </div>
          <div style={{ fontSize: "var(--font-size-xs)", color: "var(--text-muted)" }}>Today</div>
        </div>
        <div style={{ display: "flex", gap: "var(--space-sm)" }}>
          <IconButton onClick={handleAddFeed} title="Add Feed">
            +
          </IconButton>
          <IconButton onClick={() => setShowAddAccount(true)} title="Add Account">
            &#9881;
          </IconButton>
        </div>
      </div>
      <AddAccountDialog open={showAddAccount} onClose={() => setShowAddAccount(false)} />
    </>
  );
}
