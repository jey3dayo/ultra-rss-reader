import { Result } from "@praha/byethrow";
import { useQueryClient } from "@tanstack/react-query";
import { listen } from "@tauri-apps/api/event";
import { BookOpen, Copy, ExternalLink, Globe, Palette, Plus, Rss, Settings, Share2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { addAccount, deleteAccount } from "@/api/tauri-commands";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { useAccounts } from "@/hooks/use-accounts";
import { cn } from "@/lib/utils";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";

type SettingsCategory = "general" | "appearance" | "reading" | "bionic-reading" | "shortcuts" | "actions";

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
    id: "shortcuts",
    label: "Shortcuts",
    icon: <span className="flex h-5 w-5 items-center justify-center text-[11px] font-bold leading-none">&#8984;</span>,
  },
  {
    id: "actions",
    label: "Actions and Sharing",
    icon: <Share2 className="h-5 w-5" />,
  },
];

/* ---------- Reusable Settings Components ---------- */

function SettingsSwitch({ label, prefKey }: { label: string; prefKey: string }) {
  const value = usePreferencesStore((s) => s.prefs[prefKey]);
  const setPref = usePreferencesStore((s) => s.setPref);
  const checked = value === "true";
  return (
    <div className="flex min-h-[44px] items-center justify-between border-b border-border py-3">
      <span className="text-sm text-foreground">{label}</span>
      <Switch
        checked={checked}
        onCheckedChange={(v) => setPref(prefKey, String(v))}
        className="data-[state=checked]:bg-accent"
      />
    </div>
  );
}

interface SelectOption {
  value: string;
  label: string;
}

function SettingsSelect({ label, prefKey, options }: { label: string; prefKey: string; options: SelectOption[] }) {
  const value = usePreferencesStore((s) => s.prefs[prefKey]) ?? "";
  const setPref = usePreferencesStore((s) => s.setPref);
  return (
    <div className="flex min-h-[44px] items-center justify-between border-b border-border py-3">
      <span className="text-sm text-foreground">{label}</span>
      <select
        value={value}
        onChange={(e) => setPref(prefKey, e.target.value)}
        className="rounded-md border border-border bg-background px-2 py-1 text-sm text-muted-foreground"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">{children}</h3>;
}

/* ---------- Settings Row (read-only, for account detail etc.) ---------- */

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

/* ---------- Main Modal ---------- */

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
      case "shortcuts":
        return <ShortcutsSettings />;
      case "actions":
        return <ActionsSettings />;
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

/* ---------- General Tab ---------- */

function GeneralSettings() {
  return (
    <div className="p-6">
      <h2 className="mb-6 text-center text-lg font-semibold">General</h2>

      <section className="mb-6">
        <SectionHeading>App Icon</SectionHeading>
        <SettingsSelect
          label="Unread count badge"
          prefKey="unread_badge"
          options={[
            { value: "dont_display", label: "Don't display" },
            { value: "all_unread", label: "All unread" },
            { value: "only_inbox", label: "Only inbox" },
          ]}
        />
      </section>

      <section className="mb-6">
        <SectionHeading>Browser</SectionHeading>
        <SettingsSelect
          label="Open links"
          prefKey="open_links"
          options={[
            { value: "in_app", label: "In-app browser" },
            { value: "default_browser", label: "Default browser" },
          ]}
        />
        <SettingsSwitch label="Open links in background" prefKey="open_links_background" />
        <p className="mt-2 text-xs text-muted-foreground">
          Please note that some third-party browsers do not support opening links in the background.
        </p>
      </section>

      <section className="mb-6">
        <SectionHeading>Article List</SectionHeading>
        <SettingsSelect
          label="Sort unread items"
          prefKey="sort_unread"
          options={[
            { value: "newest_first", label: "Newest first" },
            { value: "oldest_first", label: "Oldest first" },
          ]}
        />
        <SettingsSelect
          label="Group by"
          prefKey="group_by"
          options={[
            { value: "date", label: "Date" },
            { value: "feed", label: "Feed" },
            { value: "none", label: "None" },
          ]}
        />
        <SettingsSwitch label={"\u2318-click opens in-app browser"} prefKey="cmd_click_browser" />
      </section>

      <section>
        <SectionHeading>Mark All As Read</SectionHeading>
        <SettingsSwitch label="Ask before" prefKey="ask_before_mark_all" />
      </section>
    </div>
  );
}

/* ---------- Appearance Tab ---------- */

function AppearanceSettings() {
  return (
    <div className="p-6">
      <h2 className="mb-6 text-center text-lg font-semibold">Appearance</h2>

      <section className="mb-6">
        <SectionHeading>General</SectionHeading>
        <SettingsSelect
          label="List selection style"
          prefKey="list_selection_style"
          options={[
            { value: "modern", label: "Modern" },
            { value: "classic", label: "Classic" },
          ]}
        />
        <SettingsSelect
          label="Layout"
          prefKey="layout"
          options={[
            { value: "automatic", label: "Automatic" },
            { value: "wide", label: "Wide" },
            { value: "compact", label: "Compact" },
          ]}
        />
        <SettingsSelect
          label="Theme"
          prefKey="theme"
          options={[
            { value: "light", label: "Light" },
            { value: "dark", label: "Dark" },
            { value: "system", label: "Automatic" },
          ]}
        />
        <SettingsSwitch label="Opaque sidebars" prefKey="opaque_sidebars" />
        <SettingsSwitch label="Grayscale favicons" prefKey="grayscale_favicons" />
      </section>

      <section className="mb-6">
        <SectionHeading>Text</SectionHeading>
        <SettingsSelect
          label="App font style"
          prefKey="font_style"
          options={[
            { value: "sans_serif", label: "Sans-serif" },
            { value: "serif", label: "Serif" },
            { value: "monospace", label: "Monospace" },
          ]}
        />
        <SettingsSelect
          label="Font size"
          prefKey="font_size"
          options={[
            { value: "small", label: "S" },
            { value: "medium", label: "M" },
            { value: "large", label: "L" },
          ]}
        />
      </section>

      <section className="mb-6">
        <SectionHeading>Display Counts</SectionHeading>
        <SettingsSwitch label="Starred list" prefKey="show_starred_count" />
        <SettingsSwitch label="Unread list" prefKey="show_unread_count" />
        <SettingsSwitch label="All items list" prefKey="show_all_count" />
      </section>

      <section>
        <SectionHeading>Article List</SectionHeading>
        <SettingsSelect
          label="Image previews"
          prefKey="image_previews"
          options={[
            { value: "off", label: "Off" },
            { value: "small", label: "Small" },
            { value: "medium", label: "Medium" },
            { value: "large", label: "Large" },
          ]}
        />
        <SettingsSwitch label="Display favicons" prefKey="display_favicons" />
        <SettingsSwitch label="Text preview" prefKey="text_preview" />
        <SettingsSwitch label="Dim archived articles" prefKey="dim_archived" />
      </section>
    </div>
  );
}

/* ---------- Reading Tab ---------- */

function ReadingSettings() {
  return (
    <div className="p-6">
      <h2 className="mb-6 text-center text-lg font-semibold">Reading</h2>

      <section className="mb-6">
        <SectionHeading>General</SectionHeading>
        <SettingsSelect
          label="Reader View"
          prefKey="reader_view"
          options={[
            { value: "off", label: "Off" },
            { value: "on", label: "On" },
            { value: "auto", label: "Automatic" },
          ]}
        />
        <SettingsSelect
          label="Sort"
          prefKey="reading_sort"
          options={[
            { value: "newest_first", label: "Newest first" },
            { value: "oldest_first", label: "Oldest first" },
          ]}
        />
        <SettingsSelect
          label="After reading"
          prefKey="after_reading"
          options={[
            { value: "mark_as_read", label: "Mark as read" },
            { value: "do_nothing", label: "Do nothing" },
            { value: "archive", label: "Archive" },
          ]}
        />
      </section>

      <section>
        <SectionHeading>Scroll</SectionHeading>
        <SettingsSwitch label="Scroll to top on feed change" prefKey="scroll_to_top_on_change" />
      </section>
    </div>
  );
}

/* ---------- Bionic Reading Tab ---------- */

function BionicReadingSettings() {
  return (
    <div className="p-6">
      <h2 className="mb-6 text-center text-lg font-semibold">Bionic Reading</h2>

      <section className="mb-6">
        <SectionHeading>About</SectionHeading>
        <p className="text-sm text-muted-foreground">What is Bionic Reading?</p>
        <p className="mt-1 text-xs text-muted-foreground">bionic-reading.com</p>
      </section>

      <section>
        <SectionHeading>Preview and Configuration</SectionHeading>
        <p className="text-sm text-foreground">With Bionic Reading you read texts faster, better and more focused.</p>
        <p className="mt-3 rounded-md bg-muted px-4 py-3 text-sm text-muted-foreground">
          Coming soon -- settings will be available in a future update.
        </p>
      </section>
    </div>
  );
}

/* ---------- Shortcuts Tab ---------- */

interface ShortcutEntry {
  category: string;
  shortcut: string;
  action: string;
}

const shortcutEntries: ShortcutEntry[] = [
  { category: "Navigation", shortcut: "j", action: "Next article" },
  { category: "Navigation", shortcut: "k", action: "Previous article" },
  { category: "Navigation", shortcut: "u", action: "Focus sidebar" },
  { category: "Actions", shortcut: "m", action: "Toggle read / unread" },
  { category: "Actions", shortcut: "s", action: "Toggle star" },
  { category: "Actions", shortcut: "v", action: "View in browser" },
  { category: "Actions", shortcut: "b", action: "Open in external browser" },
  { category: "Actions", shortcut: "r", action: "Sync all feeds" },
  { category: "Actions", shortcut: "Shift + R", action: "Sync current feed" },
  { category: "Actions", shortcut: "a", action: "Mark all as read" },
  { category: "Actions", shortcut: "f", action: "Cycle filter (All / Unread / Starred)" },
  { category: "Global", shortcut: "/", action: "Search" },
  { category: "Global", shortcut: "Escape", action: "Close browser / clear selection" },
  { category: "Global", shortcut: "\u2318 ,", action: "Open settings" },
];

function ShortcutsSettings() {
  const categories = [...new Set(shortcutEntries.map((s) => s.category))];

  return (
    <div className="p-6">
      <h2 className="mb-6 text-center text-lg font-semibold">Shortcuts</h2>

      {categories.map((cat) => (
        <section key={cat} className="mb-6">
          <SectionHeading>{cat}</SectionHeading>
          {shortcutEntries
            .filter((s) => s.category === cat)
            .map((s) => (
              <div
                key={s.shortcut}
                className="flex min-h-[44px] items-center justify-between border-b border-border py-3"
              >
                <span className="text-sm text-foreground">{s.action}</span>
                <kbd className="rounded border border-border bg-muted px-2 py-1 font-mono text-xs text-muted-foreground">
                  {s.shortcut}
                </kbd>
              </div>
            ))}
        </section>
      ))}
    </div>
  );
}

/* ---------- Actions and Sharing Tab ---------- */

interface ServiceEntry {
  label: string;
  prefKey: string;
  icon: React.ReactNode;
}

const serviceEntries: ServiceEntry[] = [
  { label: "Copy Link", prefKey: "action_copy_link", icon: <Copy className="h-5 w-5" /> },
  { label: "Open in Browser", prefKey: "action_open_browser", icon: <Globe className="h-5 w-5" /> },
  { label: "Share", prefKey: "action_share", icon: <ExternalLink className="h-5 w-5" /> },
];

function ActionsSettings() {
  return (
    <div className="p-6">
      <h2 className="mb-6 text-center text-lg font-semibold">Actions and Sharing</h2>

      <section>
        <SectionHeading>Services</SectionHeading>
        {serviceEntries.map((svc) => (
          <div key={svc.prefKey} className="flex min-h-[56px] items-center gap-3 border-b border-border py-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-muted text-muted-foreground">
              {svc.icon}
            </span>
            <span className="flex-1 text-sm text-foreground">{svc.label}</span>
            <ServiceSwitch prefKey={svc.prefKey} />
          </div>
        ))}
      </section>
    </div>
  );
}

function ServiceSwitch({ prefKey }: { prefKey: string }) {
  const value = usePreferencesStore((s) => s.prefs[prefKey]);
  const setPref = usePreferencesStore((s) => s.setPref);
  const checked = value === "true";
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground">Show in toolbar</span>
      <Switch
        checked={checked}
        onCheckedChange={(v) => setPref(prefKey, String(v))}
        className="data-[state=checked]:bg-accent"
      />
    </div>
  );
}

/* ---------- Account Detail ---------- */

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

      <section className="mb-6">
        <SectionHeading>General</SectionHeading>
        <SettingsRow label="Description" value={account.name} type="text" />
        <SettingsRow label="Type" value={account.kind === "FreshRss" ? "FreshRSS" : "Local"} type="text" />
      </section>

      <section className="mb-6">
        <SectionHeading>Syncing</SectionHeading>
        <SettingsRow label="Sync" value="Every hour" type="select" />
        <SettingsRow label="Sync on wake up from sleep" type="switch" checked={true} />
        <SettingsRow label="Keep read items" value="1 month" type="select" />
      </section>

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

/* ---------- Add Account Form ---------- */

type ProviderKind = "Local" | "FreshRss";

function AddAccountForm() {
  const { setSettingsAddAccount, setSettingsAccountId } = useUiStore();
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
        kind === "FreshRss" ? username : undefined,
        kind === "FreshRss" ? password : undefined,
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
          <SectionHeading>Server</SectionHeading>
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
