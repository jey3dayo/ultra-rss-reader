import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Result } from "@praha/byethrow";
import { addAccount } from "../api/tauri-commands";
import { useUiStore } from "../stores/ui-store";
import { Dialog, FormField, DialogActions, Button, fieldStyle } from "./Dialog";

type ProviderKind = "Local" | "FreshRss";

export function AddAccountDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [kind, setKind] = useState<ProviderKind>("Local");
  const [name, setName] = useState("");
  const [serverUrl, setServerUrl] = useState("");
  const [username, setUsername] = useState("");
  const qc = useQueryClient();

  const handleSubmit = async () => {
    try {
      console.log("[AddAccount] submitting:", { kind, name, serverUrl, username });
      const result = await addAccount(
        kind,
        name || kind,
        kind === "FreshRss" ? serverUrl : undefined,
        kind === "FreshRss" ? username : undefined,
      );
      console.log("[AddAccount] result:", result);
      if (Result.isFailure(result)) {
        alert(`Failed to add account: ${result.error.message}`);
        return;
      }
      qc.invalidateQueries({ queryKey: ["accounts"] });
      qc.invalidateQueries({ queryKey: ["feeds"] });
      const { selectAccount } = useUiStore.getState();
      selectAccount(result.value.id);
      onClose();
      setName("");
      setServerUrl("");
      setUsername("");
    } catch (e) {
      console.error("[AddAccount] unexpected error:", e);
      alert(`Unexpected error: ${e instanceof Error ? e.message : JSON.stringify(e)}`);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title="Add Account">
      <FormField label="Type">
        <select value={kind} onChange={(e) => setKind(e.target.value as ProviderKind)} style={fieldStyle}>
          <option value="Local">Local Feeds</option>
          <option value="FreshRss">FreshRSS</option>
        </select>
      </FormField>

      <FormField label="Name">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder={kind} style={fieldStyle} />
      </FormField>

      {kind === "FreshRss" && (
        <>
          <FormField label="Server URL">
            <input
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              placeholder="https://your-freshrss.com"
              style={fieldStyle}
            />
          </FormField>
          <FormField label="Username">
            <input value={username} onChange={(e) => setUsername(e.target.value)} style={fieldStyle} />
          </FormField>
        </>
      )}

      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={handleSubmit}>
          Add
        </Button>
      </DialogActions>
    </Dialog>
  );
}
