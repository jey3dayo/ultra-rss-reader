import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Result } from "@praha/byethrow";
import { addAccount } from "../../api/tauri-commands";
import { useUiStore } from "../../stores/ui-store";
import { fieldStyle } from "../Dialog";
import { SettingsRow } from "./SettingsRow";
import { SettingsSection } from "./SettingsSection";

type ProviderKind = "Local" | "FreshRss";

export function AddAccountForm() {
  const { setSettingsAddAccount, setSettingsAccountId } = useUiStore();
  const qc = useQueryClient();

  const [kind, setKind] = useState<ProviderKind>("Local");
  const [name, setName] = useState("");
  const [serverUrl, setServerUrl] = useState("");
  const [username, setUsername] = useState("");

  const handleSubmit = async () => {
    const result = await addAccount(
      kind,
      name || kind,
      kind === "FreshRss" ? serverUrl : undefined,
      kind === "FreshRss" ? username : undefined,
    );
    if (Result.isFailure(result)) {
      window.alert(`Failed to add account: ${result.error.message}`);
      return;
    }
    qc.invalidateQueries({ queryKey: ["accounts"] });
    qc.invalidateQueries({ queryKey: ["feeds"] });
    const { selectAccount } = useUiStore.getState();
    selectAccount(result.value.id);
    setSettingsAccountId(result.value.id);
  };

  const inputStyle = { ...fieldStyle, width: "auto", minWidth: 160 };

  return (
    <div style={{ padding: "var(--space-lg) 0" }}>
      {/* Header */}
      <div style={{ padding: "0 var(--space-xl)", marginBottom: "var(--space-sm)" }}>
        <div style={{ fontSize: "var(--font-size-xl)", fontWeight: "bold", color: "var(--text-primary)" }}>
          Add Account
        </div>
      </div>

      {/* Account type & name */}
      <SettingsSection title="Account">
        <SettingsRow label="Type">
          <select value={kind} onChange={(e) => setKind(e.target.value as ProviderKind)} style={inputStyle}>
            <option value="Local">Local Feeds</option>
            <option value="FreshRss">FreshRSS</option>
          </select>
        </SettingsRow>
        <SettingsRow label="Name">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={kind} style={inputStyle} />
        </SettingsRow>
      </SettingsSection>

      {kind === "FreshRss" && (
        <SettingsSection title="Server">
          <SettingsRow label="Server URL">
            <input
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              placeholder="https://your-freshrss.com"
              style={inputStyle}
            />
          </SettingsRow>
          <SettingsRow label="Username">
            <input value={username} onChange={(e) => setUsername(e.target.value)} style={inputStyle} />
          </SettingsRow>
        </SettingsSection>
      )}

      <div style={{ padding: "var(--space-xl) var(--space-xl) 0" }}>
        <button
          type="button"
          onClick={handleSubmit}
          style={{
            background: "var(--accent-blue)",
            border: "none",
            color: "#000",
            fontWeight: "bold",
            padding: "var(--space-sm) var(--space-xl)",
            borderRadius: 6,
            cursor: "pointer",
            fontSize: "var(--font-size-md)",
          }}
        >
          Add
        </button>
        <button
          type="button"
          onClick={() => setSettingsAddAccount(false)}
          style={{
            background: "none",
            border: "1px solid var(--border-subtle)",
            color: "var(--text-secondary)",
            padding: "var(--space-sm) var(--space-xl)",
            borderRadius: 6,
            cursor: "pointer",
            fontSize: "var(--font-size-md)",
            marginLeft: "var(--space-md)",
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
