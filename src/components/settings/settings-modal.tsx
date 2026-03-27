import { listen } from "@tauri-apps/api/event";
import { BookOpen, Palette, Plus, Rss, Settings, Share2, X } from "lucide-react";
import { useEffect } from "react";
import { AccountDetail } from "@/components/settings/account-detail";
import { ActionsSettings } from "@/components/settings/actions-settings";
import { AddAccountForm } from "@/components/settings/add-account-form";
import { AppearanceSettings } from "@/components/settings/appearance-settings";
import { BionicReadingSettings } from "@/components/settings/bionic-reading-settings";
import { GeneralSettings } from "@/components/settings/general-settings";
import { ReadingSettings } from "@/components/settings/reading-settings";
import { ShortcutsSettings } from "@/components/settings/shortcuts-settings";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAccounts } from "@/hooks/use-accounts";
import { cn } from "@/lib/utils";
import type { SettingsCategory } from "@/stores/ui-store";
import { useUiStore } from "@/stores/ui-store";

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

export function SettingsModal() {
  const settingsOpen = useUiStore((s) => s.settingsOpen);
  const settingsCategory = useUiStore((s) => s.settingsCategory);
  const settingsAccountId = useUiStore((s) => s.settingsAccountId);
  const settingsAddAccount = useUiStore((s) => s.settingsAddAccount);
  const closeSettings = useUiStore((s) => s.closeSettings);
  const openSettings = useUiStore((s) => s.openSettings);
  const setSettingsCategory = useUiStore((s) => s.setSettingsCategory);
  const setSettingsAccountId = useUiStore((s) => s.setSettingsAccountId);
  const setSettingsAddAccount = useUiStore((s) => s.setSettingsAddAccount);
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
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={closeSettings}
              className="text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
            >
              <X className="h-4 w-4" />
            </Button>
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
