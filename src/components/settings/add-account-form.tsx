import { Result } from "@praha/byethrow";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { addAccount } from "@/api/tauri-commands";
import { SectionHeading } from "@/components/settings/settings-components";
import { Button } from "@/components/ui/button";
import { useUiStore } from "@/stores/ui-store";

type ProviderKind = "Local" | "FreshRss" | "Inoreader";

export function AddAccountForm() {
  const setSettingsAddAccount = useUiStore((s) => s.setSettingsAddAccount);
  const setSettingsAccountId = useUiStore((s) => s.setSettingsAccountId);
  const qc = useQueryClient();
  const [kind, setKind] = useState<ProviderKind>("Local");
  const [name, setName] = useState("");
  const [serverUrl, setServerUrl] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async () => {
    Result.pipe(
      await addAccount(
        kind,
        name || kind,
        kind === "FreshRss" ? serverUrl : undefined,
        kind === "FreshRss" || kind === "Inoreader" ? username : undefined,
        kind === "FreshRss" || kind === "Inoreader" ? password : undefined,
      ),
      Result.inspectError((e) => window.alert(`Failed to add account: ${e.message}`)),
      Result.inspect((account) => {
        qc.invalidateQueries({ queryKey: ["accounts"] });
        qc.invalidateQueries({ queryKey: ["feeds"] });
        const { selectAccount } = useUiStore.getState();
        selectAccount(account.id);
        setSettingsAccountId(account.id);
      }),
    );
  };

  return (
    <div className="p-6">
      <h2 className="mb-6 text-center text-lg font-semibold">Add Account</h2>

      <section className="mb-6">
        <SectionHeading>Account</SectionHeading>
        <div className="flex min-h-[44px] items-center justify-between border-b border-border py-3">
          <span className="text-sm text-foreground">Type</span>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as ProviderKind)}
            className="rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground"
          >
            <option value="Local">Local Feeds</option>
            <option value="FreshRss">FreshRSS</option>
            <option value="Inoreader">Inoreader</option>
          </select>
        </div>
        <div className="flex min-h-[44px] items-center justify-between border-b border-border py-3">
          <span className="text-sm text-foreground">Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={kind}
            className="rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground"
          />
        </div>
      </section>

      {(kind === "FreshRss" || kind === "Inoreader") && (
        <section className="mb-6">
          <SectionHeading>{kind === "FreshRss" ? "Server" : "Credentials"}</SectionHeading>
          {kind === "FreshRss" && (
            <div className="flex min-h-[44px] items-center justify-between border-b border-border py-3">
              <span className="text-sm text-foreground">Server URL</span>
              <input
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
                placeholder="https://your-freshrss.com"
                className="rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground"
              />
            </div>
          )}
          <div className="flex min-h-[44px] items-center justify-between border-b border-border py-3">
            <span className="text-sm text-foreground">{kind === "Inoreader" ? "Email" : "Username"}</span>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground"
            />
          </div>
          <div className="flex min-h-[44px] items-center justify-between border-b border-border py-3">
            <span className="text-sm text-foreground">Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground"
            />
          </div>
        </section>
      )}

      <div className="flex gap-3">
        <Button onClick={handleSubmit}>Add</Button>
        <Button variant="outline" onClick={() => setSettingsAddAccount(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
