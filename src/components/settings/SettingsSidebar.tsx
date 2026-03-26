import type { CSSProperties } from "react";
import { useAccounts } from "../../hooks/use-accounts";
import { useUiStore } from "../../stores/ui-store";

export function SettingsSidebar() {
  const {
    settingsCategory,
    settingsAccountId,
    settingsAddAccount,
    setSettingsCategory,
    setSettingsAccountId,
    setSettingsAddAccount,
  } = useUiStore();
  const { data: accounts } = useAccounts();

  const isGeneralActive = settingsCategory === "general" && !settingsAccountId && !settingsAddAccount;

  const separatorStyle: CSSProperties = {
    height: 1,
    background: "var(--border-subtle)",
    margin: "var(--space-sm) var(--space-lg)",
  };

  const itemBase: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: "var(--space-sm)",
    width: "100%",
    padding: "6px var(--space-lg)",
    background: "transparent",
    border: "none",
    borderRadius: 6,
    color: "var(--text-secondary)",
    fontSize: "var(--font-size-md)",
    cursor: "pointer",
    textAlign: "left",
  };

  return (
    <div
      style={{
        width: 180,
        borderRight: "1px solid var(--border-subtle)",
        padding: "var(--space-md) 0",
        flexShrink: 0,
        overflowY: "auto",
      }}
    >
      {/* General */}
      <button
        type="button"
        onClick={() => setSettingsCategory("general")}
        style={{
          ...itemBase,
          background: isGeneralActive ? "var(--bg-selected)" : "transparent",
          color: isGeneralActive ? "var(--text-primary)" : "var(--text-secondary)",
        }}
      >
        <span style={{ fontSize: "var(--font-size-lg)" }}>{"\u2699"}</span>
        General
      </button>

      {/* Separator */}
      <div style={separatorStyle} />

      {/* Accounts */}
      {accounts?.map((acc) => {
        const isActive = settingsAccountId === acc.id;
        const icon = acc.kind === "FreshRss" ? "\uD83D\uDFE0" : "\uD83D\uDFE2";
        return (
          <button
            type="button"
            key={acc.id}
            onClick={() => setSettingsAccountId(acc.id)}
            style={{
              ...itemBase,
              flexDirection: "column",
              alignItems: "flex-start",
              gap: 0,
              background: isActive ? "var(--bg-selected)" : "transparent",
              color: isActive ? "var(--text-primary)" : "var(--text-secondary)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
              <span style={{ fontSize: 10 }}>{icon}</span>
              <span style={{ fontWeight: 500 }}>{acc.name}</span>
            </div>
            <span
              style={{
                fontSize: "var(--font-size-xs)",
                color: "var(--text-muted)",
                paddingLeft: 18,
              }}
            >
              {acc.kind === "FreshRss" ? "FreshRSS" : "Local"}
            </span>
          </button>
        );
      })}

      {/* Separator */}
      <div style={separatorStyle} />

      {/* Add Account */}
      <button
        type="button"
        onClick={() => setSettingsAddAccount(true)}
        style={{
          ...itemBase,
          background: settingsAddAccount ? "var(--bg-selected)" : "transparent",
          color: settingsAddAccount ? "var(--text-primary)" : "var(--text-secondary)",
        }}
      >
        <span style={{ fontSize: "var(--font-size-lg)" }}>+</span>
        Add Account...
      </button>
    </div>
  );
}
