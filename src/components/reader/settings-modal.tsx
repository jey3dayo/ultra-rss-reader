import { Result } from "@praha/byethrow";
import { useQueryClient } from "@tanstack/react-query";
import { listen } from "@tauri-apps/api/event";
import { BookOpen, Palette, Plus, Pointer, Puzzle, Rss, Settings, Share2, Sparkles, X } from "lucide-react";
import { useEffect, useState } from "react";
import { addAccount, deleteAccount } from "@/api/tauri-commands";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { useAccounts } from "@/hooks/use-accounts";
import { cn } from "@/lib/utils";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";

type SettingsCategory =
  | "general"
  | "appearance"
  | "reading"
  | "bionic-reading"
  | "animations"
  | "shortcuts"
  | "gestures"
  | "actions"
  | "services";

interface NavItem {
  id: SettingsCategory;
  label: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  {
    id: "general",
    label: "General",
    icon: <Settings className="h-5 w-5" />,
  },
  {
    id: "appearance",
    label: "Appearance",
    icon: <Palette className="h-5 w-5" />,
  },
  {
    id: "reading",
    label: "Reading",
    icon: <BookOpen className="h-5 w-5" />,
  },
  {
    id: "bionic-reading",
    label: "Bionic Reading",
    icon: <span className="flex h-5 w-5 items-center justify-center text-[11px] font-bold leading-none">BR</span>,
  },
  {
    id: "animations",
    label: "Animations",
    icon: <Sparkles className="h-5 w-5" />,
  },
  {
    id: "shortcuts",
    label: "Shortcuts",
    icon: <span className="flex h-5 w-5 items-center justify-center text-[11px] font-bold leading-none">&#8984;</span>,
  },
  {
    id: "gestures",
    label: "Gestures",
    icon: <Pointer className="h-5 w-5" />,
  },
  {
    id: "actions",
    label: "Actions and Sharing",
    icon: <Share2 className="h-5 w-5" />,
  },
  {
    id: "services",
    label: "Services",
    icon: <Puzzle className="h-5 w-5" />,
  },
];

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

  const renderContent = () => {
    if (settingsAccountId) {
      return <AccountDetail />;
    }
    if (settingsAddAccount) {
      return <AddAccountForm />;
    }
    switch (settingsCategory) {
      case "appearance":
        return <AppearanceSettings />;
      case "reading":
        return <ReadingSettings />;
      case "bionic-reading":
        return <BionicReadingSettings />;
      case "animations":
        return <AnimationsSettings />;
      case "shortcuts":
        return <ShortcutsSettings />;
      case "gestures":
        return <GesturesSettings />;
      case "actions":
        return <ActionsSettings />;
      case "services":
        return <ServicesSettings />;
      default:
        return <GeneralSettings />;
    }
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
              {navItems.map((item) => {
                const isActive = settingsCategory === item.id && !settingsAccountId && !settingsAddAccount;
                return (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => setSettingsCategory(item.id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                      isActive
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-sidebar-foreground hover:bg-sidebar-accent/50",
                    )}
                  >
                    <span className="flex h-6 w-6 items-center justify-center text-muted-foreground">{item.icon}</span>
                    {item.label}
                  </button>
                );
              })}
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
        <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">App Icon</h3>
        <SettingsRow label="Unread count badge" value="Don't display" type="select" />
      </section>

      {/* Browser Section */}
      <section className="mb-6">
        <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Browser</h3>
        <SettingsRow label="Open links" value="In-app browser" type="select" />
        <SettingsRow label="Default browser" value="Use system default" type="select" />
        <SettingsRow label="Open links in background" type="switch" checked={false} />
        <p className="mt-2 text-xs text-muted-foreground">
          Please note that some third-party browsers do not support opening links in the background.
        </p>
      </section>

      {/* Article List Section */}
      <section className="mb-6">
        <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Article List</h3>
        <SettingsRow label="Sort unread items" value="Newest first" type="select" />
        <SettingsRow label="Group by" value="Date" type="select" />
        <SettingsRow label="⌘-click opens in-app browser" type="switch" checked={false} />
      </section>

      {/* Mark All As Read Section */}
      <section>
        <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Mark All As Read</h3>
        <SettingsRow label="Ask before" type="switch" checked={true} />
      </section>
    </div>
  );
}

function AppearanceSettings() {
  const theme = usePreferencesStore((s) => s.theme());
  const setPref = usePreferencesStore((s) => s.setPref);

  const themeOptions = [
    { value: "light", label: "Light" },
    { value: "dark", label: "Dark" },
    { value: "system", label: "Automatic" },
  ] as const;

  return (
    <div className="p-6">
      <h2 className="mb-6 text-center text-lg font-semibold">Appearance</h2>

      <section className="mb-6">
        <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">General</h3>
        <SettingsRow label="List selection style" value="Modern" type="select" />
        <SettingsRow label="Layout" value="Automatic" type="select" />
        <div className="flex min-h-[44px] items-center justify-between border-b border-border py-3">
          <span className="text-sm text-foreground">Theme</span>
          <select
            value={theme}
            onChange={(e) => setPref("theme", e.target.value)}
            className="rounded-md border border-border bg-background px-2 py-1 text-sm text-muted-foreground"
          >
            {themeOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <SettingsRow label="Opaque sidebars" type="switch" checked={false} />
        <SettingsRow label="Grayscale favicons" type="switch" checked={false} />
      </section>

      <section className="mb-6">
        <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Text</h3>
        <SettingsRow label="App font style" value="Sans-serif" type="select" />
        <SettingsRow label="Font size" value="M" type="text" />
      </section>

      <section className="mb-6">
        <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Display Counts</h3>
        <SettingsRow label="Starred list" type="switch" checked={true} />
        <SettingsRow label="Unread list" type="switch" checked={true} />
        <SettingsRow label="All items list" type="switch" checked={true} />
      </section>

      <section>
        <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Article List</h3>
        <SettingsRow label="Image previews" value="Medium" type="select" />
        <SettingsRow label="Display favicons" type="switch" checked={true} />
        <SettingsRow label="Text preview" type="switch" checked={true} />
        <SettingsRow label="Dim archived articles" type="switch" checked={true} />
      </section>
    </div>
  );
}

function ReadingSettings() {
  return (
    <div className="p-6">
      <h2 className="mb-6 text-center text-lg font-semibold">Reading</h2>

      <section className="mb-6">
        <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">General</h3>
        <SettingsRow label="Reader View" value="Off" type="select" />
        <SettingsRow label="Sort" value="Newest first" type="select" />
        <SettingsRow label="After reading" value="Mark as read" type="select" />
      </section>

      <section>
        <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Scroll</h3>
        <SettingsRow label="Scroll to top on feed change" type="switch" checked={true} />
      </section>
    </div>
  );
}

function BionicReadingSettings() {
  return (
    <div className="p-6">
      <h2 className="mb-6 text-center text-lg font-semibold">Bionic Reading</h2>

      <section className="mb-6">
        <SettingsRow label="Bionic Reading" type="switch" checked={false} />
        <p className="mt-2 text-xs text-muted-foreground">
          Bionic Reading highlights key parts of words to help you read faster.
        </p>
      </section>
    </div>
  );
}

function AnimationsSettings() {
  return (
    <div className="p-6">
      <h2 className="mb-6 text-center text-lg font-semibold">Animations</h2>

      <section>
        <SettingsRow label="Animations" type="switch" checked={true} />
        <SettingsRow label="Reduce motion" type="switch" checked={false} />
      </section>
    </div>
  );
}

function ShortcutsSettings() {
  return (
    <div className="p-6">
      <h2 className="mb-6 text-center text-lg font-semibold">Shortcuts</h2>

      <p className="text-sm text-muted-foreground">Keyboard shortcuts reference coming soon.</p>
    </div>
  );
}

function GesturesSettings() {
  return (
    <div className="p-6">
      <h2 className="mb-6 text-center text-lg font-semibold">Gestures</h2>

      <section>
        <SettingsRow label="Swipe left" value="Mark as read" type="select" />
        <SettingsRow label="Swipe right" value="Toggle star" type="select" />
      </section>
    </div>
  );
}

function ActionsSettings() {
  return (
    <div className="p-6">
      <h2 className="mb-6 text-center text-lg font-semibold">Actions and Sharing</h2>

      <section>
        <SettingsRow label="Default share action" value="Copy link" type="select" />
        <SettingsRow label="Open in browser" value="Default browser" type="select" />
      </section>
    </div>
  );
}

function ServicesSettings() {
  return (
    <div className="p-6">
      <h2 className="mb-6 text-center text-lg font-semibold">Services</h2>

      <p className="text-sm text-muted-foreground">Third-party integrations coming soon.</p>
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
    Result.pipe(
      await deleteAccount(account.id),
      Result.inspectError((e) => window.alert(`Failed to delete account: ${e.message}`)),
      Result.inspect(() => {
        qc.invalidateQueries({ queryKey: ["accounts"] });
        qc.invalidateQueries({ queryKey: ["feeds"] });
        setSettingsAccountId(null);
      }),
    );
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
    Result.pipe(
      await addAccount(
        kind,
        name || kind,
        kind === "FreshRss" ? serverUrl : undefined,
        kind === "FreshRss" ? username : undefined,
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
