import { useAccounts } from "../../hooks/use-accounts";
import { useUiStore } from "../../stores/ui-store";

export function AccountsSettings() {
  const { data: accounts } = useAccounts();
  const { setSettingsAccountId, setSettingsAddAccount } = useUiStore();

  return (
    <div style={{ padding: "var(--space-xl)" }}>
      <div
        style={{
          fontSize: "var(--font-size-xs)",
          color: "var(--text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          marginBottom: "var(--space-md)",
        }}
      >
        Accounts
      </div>

      <div
        style={{
          border: "1px solid var(--border-subtle)",
          borderRadius: 8,
          overflow: "hidden",
          marginBottom: "var(--space-lg)",
        }}
      >
        {accounts?.map((acc, idx) => (
          <button
            type="button"
            key={acc.id}
            onClick={() => setSettingsAccountId(acc.id)}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              width: "100%",
              padding: "var(--space-md) var(--space-lg)",
              background: "transparent",
              border: "none",
              borderTop: idx > 0 ? "1px solid var(--border-subtle)" : "none",
              color: "var(--text-secondary)",
              fontSize: "var(--font-size-md)",
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
              <span>{acc.kind === "FreshRss" ? "\uD83D\uDCE1" : "\uD83D\uDCC1"}</span>
              <span style={{ fontWeight: 500 }}>{acc.name}</span>
              {acc.kind === "FreshRss" && (
                <span style={{ color: "var(--text-muted)", fontSize: "var(--font-size-xs)" }}>{acc.kind}</span>
              )}
            </div>
            <span style={{ color: "var(--text-muted)" }}>&gt;</span>
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setSettingsAddAccount(true)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-sm)",
          background: "none",
          border: "none",
          color: "var(--accent-blue)",
          fontSize: "var(--font-size-md)",
          cursor: "pointer",
          padding: 0,
        }}
      >
        + Add Account
      </button>
    </div>
  );
}
