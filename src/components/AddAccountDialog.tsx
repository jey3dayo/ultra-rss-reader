import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { addAccount } from "../api/tauri-commands";

type ProviderKind = "Local" | "FreshRss";

const labelStyle = {
  fontSize: "var(--font-size-sm)",
  color: "var(--text-tertiary)",
  display: "block",
  marginBottom: "var(--space-xs)",
};

const inputStyle = {
  width: "100%",
  padding: "var(--space-sm)",
  background: "var(--bg-content)",
  border: "1px solid var(--border-subtle)",
  borderRadius: 6,
  color: "var(--text-primary)",
};

export function AddAccountDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [kind, setKind] = useState<ProviderKind>("Local");
  const [name, setName] = useState("");
  const [serverUrl, setServerUrl] = useState("");
  const [username, setUsername] = useState("");
  const qc = useQueryClient();

  if (!open) return null;

  const handleSubmit = async () => {
    await addAccount(
      kind,
      name || kind,
      kind === "FreshRss" ? serverUrl : undefined,
      kind === "FreshRss" ? username : undefined,
    );
    qc.invalidateQueries({ queryKey: ["accounts"] });
    onClose();
    setName("");
    setServerUrl("");
    setUsername("");
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
      }}
    >
      <div
        style={{
          background: "var(--bg-sidebar)",
          borderRadius: 12,
          padding: "var(--space-xl)",
          width: 400,
          maxWidth: "90vw",
        }}
      >
        <h2 style={{ fontSize: "var(--font-size-xl)", marginBottom: "var(--space-lg)" }}>Add Account</h2>

        <div style={{ marginBottom: "var(--space-md)" }}>
          <label style={labelStyle}>
            Type
            <select value={kind} onChange={(e) => setKind(e.target.value as ProviderKind)} style={inputStyle}>
              <option value="Local">Local Feeds</option>
              <option value="FreshRss">FreshRSS</option>
            </select>
          </label>
        </div>

        <div style={{ marginBottom: "var(--space-md)" }}>
          <label style={labelStyle}>
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder={kind} style={inputStyle} />
          </label>
        </div>

        {kind === "FreshRss" && (
          <>
            <div style={{ marginBottom: "var(--space-md)" }}>
              <label style={labelStyle}>
                Server URL
                <input
                  value={serverUrl}
                  onChange={(e) => setServerUrl(e.target.value)}
                  placeholder="https://your-freshrss.com"
                  style={inputStyle}
                />
              </label>
            </div>
            <div style={{ marginBottom: "var(--space-md)" }}>
              <label style={labelStyle}>
                Username
                <input value={username} onChange={(e) => setUsername(e.target.value)} style={inputStyle} />
              </label>
            </div>
          </>
        )}

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "var(--space-sm)",
            marginTop: "var(--space-lg)",
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "var(--space-sm) var(--space-lg)",
              background: "none",
              border: "1px solid var(--border-subtle)",
              borderRadius: 6,
              color: "var(--text-secondary)",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            style={{
              padding: "var(--space-sm) var(--space-lg)",
              background: "var(--accent-blue)",
              border: "none",
              borderRadius: 6,
              color: "#000",
              cursor: "pointer",
              fontWeight: "bold",
            }}
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}
