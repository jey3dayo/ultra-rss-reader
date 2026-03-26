import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Result } from "@praha/byethrow";
import { listen } from "@tauri-apps/api/event";
import { X, Settings, Rss, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { addAccount, deleteAccount } from "@/api/tauri-commands";
import { useAccounts } from "@/hooks/use-accounts";
import { useUiStore } from "@/stores/ui-store";

export function SettingsModal() {
  const {
    settingsOpen,
    settingsCategory,
    settingsAccountId,
    settingsAddAccount,
    closeSettings,
    openSettings,
    setSettingsCategory,
    setSettingsAccountId,
    setSettingsAddAccount,
  } = useUiStore();
  const { data: accounts } = useAccounts();

  // Listen for Tauri menu event
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    listen("open-settings", () => openSettings())
      .then((fn) => {
        unlisten = fn;
      })
      .catch(() => {}); // Ignore in browser mode
    return () => unlisten?.();
  }, [openSettings]);

  const isGeneralActive = settingsCategory === "general" && !settingsAccountId && !settingsAddAccount;

  const renderContent = () => {
    if (settingsAccountId) {
      return <AccountDetail />;
    }
    if (settingsAddAccount) {
      return <AddAccountForm />;
    }
    return <GeneralSettings />;
  };

  return (
    <Dialog open={settingsOpen} onOpenChange={(open) => (!open ? closeSettings() : openSettings())}>
      <DialogContent
        className="flex h-[80vh] max-h-[720px] max-w-[920px] sm:max-w-[920px] gap-0 overflow-hidden p-0"
        showCloseButton={false}
      >
        {/* Sidebar Navigation */}
        <div className="flex w-[260px] flex-col border-r border-border bg-sidebar">
          {/* Header */}
          <DialogHeader className="flex flex-row items-center gap-3 border-b border-border px-4 py-4">
            <button
              type="button"
              onClick={closeSettings}
              className="rounded p-1 text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
            >
              <X className="h-4 w-4" />
            </button>
            <DialogTitle className="text-base font-medium">Preferences</DialogTitle>
          </DialogHeader>

          {/* Navigation */}
          <ScrollArea className="flex-1">
            <nav className="space-y-1 p-2">
              <button
                type="button"
                onClick={() => setSettingsCategory("general")}
                className={cn(
                  "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                  isGeneralActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/50",
                )}
              >
                <span className="flex h-6 w-6 items-center justify-center text-muted-foreground">
                  <Settings className="h-5 w-5" />
                </span>
                General
              </button>
            </nav>
          </ScrollArea>

          {/* Accounts Section */}
          <div className="border-t border-border p-2">
            {accounts?.map((account) => (
              <button
                type="button"
                key={account.id}
                onClick={() => setSettingsAccountId(account.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                  settingsAccountId === account.id ? "bg-sidebar-accent" : "hover:bg-sidebar-accent/50",
                )}
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <Rss className="h-4 w-4" />
                </span>
                <div className="flex flex-col items-start">
                  <span className="font-medium">{account.name}</span>
                  <span className="text-xs text-muted-foreground">{account.kind}</span>
                </div>
              </button>
            ))}
            <button
              type="button"
              onClick={() => setSettingsAddAccount(true)}
              className={cn(
                "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground",
                settingsAddAccount ? "bg-sidebar-accent" : "hover:bg-sidebar-accent/50",
              )}
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                <Plus className="h-4 w-4" />
              </span>
              Add Account...
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex flex-1 flex-col bg-popover">
          <ScrollArea className="flex-1">{renderContent()}</ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function GeneralSettings() {
  return (
    <div className="p-6">
      <h2 className="mb-6 text-center text-lg font-semibold">General</h2>

      {/* App Icon Section */}
      <section className="mb-6">
        <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">About</h3>
        <SettingsRow label="Version" value="0.1.0" type="text" />
      </section>

      {/* Browser Section */}
      <section className="mb-6">
        <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Browser</h3>
        <SettingsRow label="Open links" value="In-app browser" type="select" />
        <SettingsRow label="Open links in background" type="switch" checked={false} />
      </section>

      {/* Article List Section */}
      <section className="mb-6">
        <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Article List</h3>
        <SettingsRow label="Sort unread items" value="Newest first" type="select" />
        <SettingsRow label="Group by" value="Date" type="select" />
      </section>

      {/* Mark All As Read Section */}
      <section>
        <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Mark All As Read</h3>
        <SettingsRow label="Ask before" type="switch" checked={true} />
      </section>
    </div>
  );
}

function AccountDetail() {
  const { settingsAccountId, setSettingsAccountId } = useUiStore();
  const { data: accounts } = useAccounts();
  const qc = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const account = accounts?.find((a) => a.id === settingsAccountId);

  if (!account) return null;

  const handleDelete = async () => {
    const result = await deleteAccount(account.id);
    if (Result.isFailure(result)) {
      window.alert(`Failed to delete account: ${result.error.message}`);
      return;
    }
    qc.invalidateQueries({ queryKey: ["accounts"] });
    qc.invalidateQueries({ queryKey: ["feeds"] });
    setSettingsAccountId(null);
  };

  return (
    <div className="p-6">
      <h2 className="mb-2 text-center text-lg font-semibold">{account.name}</h2>
      <p className="mb-6 text-center text-sm text-muted-foreground">{account.kind}</p>

      {/* General Section */}
      <section className="mb-6">
        <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">General</h3>
        <SettingsRow label="Description" value={account.name} type="text" />
        <SettingsRow label="Type" value={account.kind === "FreshRss" ? "FreshRSS" : "Local"} type="text" />
      </section>

      {/* Syncing Section */}
      <section className="mb-6">
        <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Syncing</h3>
        <SettingsRow label="Sync" value="Every hour" type="select" />
        <SettingsRow label="Sync on wake up from sleep" type="switch" checked={true} />
        <SettingsRow label="Keep read items" value="1 month" type="select" />
      </section>

      {/* Delete account */}
      <div className="mt-6 border-t border-border pt-6">
        {!confirmDelete ? (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="text-sm text-destructive hover:underline"
          >
            Delete Account
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <span className="text-sm text-destructive">Delete this account?</span>
            <button
              type="button"
              onClick={handleDelete}
              className="rounded-md bg-destructive px-3 py-1.5 text-sm text-white"
            >
              Delete
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="rounded-md border border-border px-3 py-1.5 text-sm text-foreground"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

type ProviderKind = "Local" | "FreshRss";

function AddAccountForm() {
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
    <div className="p-6">
      <h2 className="mb-6 text-center text-lg font-semibold">Add Account</h2>

      <section className="mb-6">
        <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Account</h3>
        <div className="flex min-h-[44px] items-center justify-between border-b border-border py-3">
          <span className="text-sm text-foreground">Type</span>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as ProviderKind)}
            className="rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground"
          >
            <option value="Local">Local Feeds</option>
            <option value="FreshRss">FreshRSS</option>
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

      {kind === "FreshRss" && (
        <section className="mb-6">
          <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Server</h3>
          <div className="flex min-h-[44px] items-center justify-between border-b border-border py-3">
            <span className="text-sm text-foreground">Server URL</span>
            <input
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              placeholder="https://your-freshrss.com"
              className="rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground"
            />
          </div>
          <div className="flex min-h-[44px] items-center justify-between border-b border-border py-3">
            <span className="text-sm text-foreground">Username</span>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground"
            />
          </div>
        </section>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={handleSubmit}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground"
        >
          Add
        </button>
        <button
          type="button"
          onClick={() => setSettingsAddAccount(false)}
          className="rounded-md border border-border px-4 py-2 text-sm text-foreground"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

interface SettingsRowProps {
  label: string;
  value?: string;
  type: "switch" | "select" | "text";
  checked?: boolean;
  truncate?: boolean;
}

function SettingsRow({ label, value, type, checked, truncate }: SettingsRowProps) {
  return (
    <div className="flex min-h-[44px] items-center justify-between border-b border-border py-3">
      <span className="text-sm text-foreground">{label}</span>
      {type === "switch" && <Switch checked={checked} className="data-[state=checked]:bg-accent" />}
      {type === "select" && <span className="text-sm text-muted-foreground">{value} &#9662;</span>}
      {type === "text" && (
        <span className={cn("text-sm text-muted-foreground", truncate && "max-w-[200px] truncate")}>{value}</span>
      )}
    </div>
  );
}
