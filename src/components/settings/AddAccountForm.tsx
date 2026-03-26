import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Result } from "@praha/byethrow";
import { addAccount } from "../../api/tauri-commands";
import { useUiStore } from "../../stores/ui-store";
import { fieldStyle } from "../Dialog";

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

  return (
    <div style={{ padding: "var(--space-xl)" }}>
      <button
        type="button"
        onClick={() => setSettingsAddAccount(false)}
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

      <div
        style={{
          fontSize: "var(--font-size-xl)",
          fontWeight: "bold",
          color: "var(--text-primary)",
          marginBottom: "var(--space-xl)",
        }}
      >
        Add Account
      </div>

      <div style={{ marginBottom: "var(--space-md)" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "var(--space-sm) 0",
          }}
        >
          <span style={{ color: "var(--text-tertiary)", fontSize: "var(--font-size-md)" }}>Type</span>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as ProviderKind)}
            style={{ ...fieldStyle, width: "auto", minWidth: 160 }}
          >
            <option value="Local">Local Feeds</option>
            <option value="FreshRss">FreshRSS</option>
          </select>
        </div>
      </div>

      <div style={{ marginBottom: "var(--space-md)" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "var(--space-sm) 0",
          }}
        >
          <span style={{ color: "var(--text-tertiary)", fontSize: "var(--font-size-md)" }}>Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={kind}
            style={{ ...fieldStyle, width: "auto", minWidth: 160 }}
          />
        </div>
      </div>

      {kind === "FreshRss" && (
        <>
          <div style={{ marginBottom: "var(--space-md)" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "var(--space-sm) 0",
              }}
            >
              <span style={{ color: "var(--text-tertiary)", fontSize: "var(--font-size-md)" }}>Server URL</span>
              <input
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
                placeholder="https://your-freshrss.com"
                style={{ ...fieldStyle, width: "auto", minWidth: 160 }}
              />
            </div>
          </div>

          <div style={{ marginBottom: "var(--space-md)" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "var(--space-sm) 0",
              }}
            >
              <span style={{ color: "var(--text-tertiary)", fontSize: "var(--font-size-md)" }}>Username</span>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                style={{ ...fieldStyle, width: "auto", minWidth: 160 }}
              />
            </div>
          </div>
        </>
      )}

      <div style={{ marginTop: "var(--space-xl)" }}>
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
      </div>
    </div>
  );
}
