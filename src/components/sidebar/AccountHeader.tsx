import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Result } from "@praha/byethrow";
import { addLocalFeed } from "../../api/tauri-commands";
import { useAccounts } from "../../hooks/use-accounts";
import { useUiStore } from "../../stores/ui-store";
import { IconButton } from "../IconButton";

export function AccountHeader() {
  const [showAccountList, setShowAccountList] = useState(false);
  const { data: accounts } = useAccounts();
  const { selectedAccountId, selectAccount } = useUiStore();
  const qc = useQueryClient();

  const selectedAccount = accounts?.find((a) => a.id === selectedAccountId);
  const hasMultipleAccounts = accounts && accounts.length > 1;

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
    <div
      style={{
        padding: "var(--space-lg) var(--space-lg) var(--space-sm)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      <div style={{ position: "relative" }}>
        <button
          type="button"
          onClick={() => hasMultipleAccounts && setShowAccountList((v) => !v)}
          style={{
            background: "none",
            border: "none",
            padding: 0,
            cursor: hasMultipleAccounts ? "pointer" : "default",
            textAlign: "left",
            color: "inherit",
          }}
        >
          <div
            style={{
              fontSize: "var(--font-size-xl)",
              fontWeight: "bold",
              display: "flex",
              alignItems: "center",
              gap: "var(--space-xs)",
            }}
          >
            {selectedAccount?.name ?? "Ultra RSS"}
            {hasMultipleAccounts && (
              <span style={{ fontSize: "var(--font-size-xs)", color: "var(--text-muted)" }}>&#9662;</span>
            )}
          </div>
          <div style={{ fontSize: "var(--font-size-xs)", color: "var(--text-muted)" }}>Today</div>
        </button>
        {showAccountList && accounts && (
          <div
            style={{
              position: "absolute",
              top: "100%",
              left: 0,
              zIndex: 50,
              background: "var(--bg-sidebar)",
              border: "1px solid var(--border-subtle)",
              borderRadius: 8,
              padding: "var(--space-xs)",
              minWidth: 180,
              boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
            }}
          >
            {accounts.map((acc) => (
              <button
                type="button"
                key={acc.id}
                onClick={() => {
                  selectAccount(acc.id);
                  setShowAccountList(false);
                }}
                style={{
                  display: "block",
                  width: "100%",
                  padding: "var(--space-sm) var(--space-md)",
                  background: acc.id === selectedAccountId ? "var(--bg-selected)" : "transparent",
                  border: "none",
                  borderRadius: 4,
                  color: "var(--text-secondary)",
                  fontSize: "var(--font-size-md)",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                {acc.name}
                <span
                  style={{
                    fontSize: "var(--font-size-xs)",
                    color: "var(--text-muted)",
                    marginLeft: "var(--space-sm)",
                  }}
                >
                  {acc.kind}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
      <div style={{ display: "flex", gap: "var(--space-sm)" }}>
        <IconButton onClick={handleAddFeed} title="Add Feed">
          +
        </IconButton>
      </div>
    </div>
  );
}
