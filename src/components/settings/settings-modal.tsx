import { BookOpen, Bug, Database, Palette, Settings, Share2 } from "lucide-react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { AccountDetail } from "@/components/settings/account-detail";
import { type AccountNavItem, AccountsNavView } from "@/components/settings/accounts-nav-view";
import { ActionsSettings } from "@/components/settings/actions-settings";
import { AddAccountForm } from "@/components/settings/add-account-form";
import { AppearanceSettings } from "@/components/settings/appearance-settings";
import { DataSettings } from "@/components/settings/data-settings";
import { DebugSettings } from "@/components/settings/debug-settings";
import { GeneralSettings } from "@/components/settings/general-settings";
import { ReadingSettings } from "@/components/settings/reading-settings";
import { SettingsModalView } from "@/components/settings/settings-modal-view";
import { type SettingsNavItem, type SettingsNavItemId, SettingsNavView } from "@/components/settings/settings-nav-view";
import { ShortcutsSettings } from "@/components/settings/shortcuts-settings";
import { useAccounts } from "@/hooks/use-accounts";
import type { SettingsCategory } from "@/stores/ui-store";
import { useUiStore } from "@/stores/ui-store";

function SettingsContent({
  settingsAccountId,
  settingsAddAccount,
  settingsCategory,
}: {
  settingsAccountId: string | null;
  settingsAddAccount: boolean;
  settingsCategory: SettingsCategory;
}) {
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
    case "shortcuts":
      return <ShortcutsSettings />;
    case "actions":
      return <ActionsSettings />;
    case "data":
      return <DataSettings />;
    case "debug":
      return <DebugSettings />;
    default:
      return <GeneralSettings />;
  }
}

const settingsCategoryByNavId: Record<string, SettingsCategory> = {
  general: "general",
  appearance: "appearance",
  reading: "reading",
  shortcuts: "shortcuts",
  actions: "actions",
  data: "data",
  debug: "debug",
};

export function SettingsModal() {
  const { t } = useTranslation("settings");
  const settingsOpen = useUiStore((s) => s.settingsOpen);
  const settingsCategory = useUiStore((s) => s.settingsCategory);
  const settingsAccountId = useUiStore((s) => s.settingsAccountId);
  const settingsAddAccount = useUiStore((s) => s.settingsAddAccount);
  const closeSettings = useUiStore((s) => s.closeSettings);
  const openSettings = useUiStore((s) => s.openSettings);
  const setSettingsCategory = useUiStore((s) => s.setSettingsCategory);
  const setSettingsAccountId = useUiStore((s) => s.setSettingsAccountId);
  const setSettingsAddAccount = useUiStore((s) => s.setSettingsAddAccount);
  const settingsLoading = useUiStore((s) => s.settingsLoading);
  const { data: accounts } = useAccounts();

  // Auto-select first account when navigating to accounts section via menu
  useEffect(() => {
    if (settingsCategory === "accounts" && !settingsAccountId && !settingsAddAccount) {
      if (accounts && accounts.length > 0) {
        setSettingsAccountId(accounts[0].id);
      } else {
        setSettingsAddAccount(true);
      }
    }
  }, [settingsCategory, settingsAccountId, settingsAddAccount, accounts, setSettingsAccountId, setSettingsAddAccount]);

  const navItems: SettingsNavItem[] = [
    {
      id: "general",
      label: t("nav.general"),
      icon: <Settings className="h-5 w-5" />,
      isActive: settingsCategory === "general" && !settingsAccountId && !settingsAddAccount,
    },
    {
      id: "appearance",
      label: t("nav.appearance"),
      icon: <Palette className="h-5 w-5" />,
      isActive: settingsCategory === "appearance" && !settingsAccountId && !settingsAddAccount,
    },
    {
      id: "reading",
      label: t("nav.reading"),
      icon: <BookOpen className="h-5 w-5" />,
      isActive: settingsCategory === "reading" && !settingsAccountId && !settingsAddAccount,
    },
    {
      id: "shortcuts",
      label: t("nav.shortcuts"),
      icon: (
        <span className="flex h-5 w-5 items-center justify-center text-[11px] font-bold leading-none">&#8984;</span>
      ),
      isActive: settingsCategory === "shortcuts" && !settingsAccountId && !settingsAddAccount,
    },
    {
      id: "actions",
      label: t("nav.actions"),
      icon: <Share2 className="h-5 w-5" />,
      isActive: settingsCategory === "actions" && !settingsAccountId && !settingsAddAccount,
    },
    {
      id: "data",
      label: t("nav.data"),
      icon: <Database className="h-5 w-5" />,
      isActive: settingsCategory === "data" && !settingsAccountId && !settingsAddAccount,
    },
    {
      id: "debug",
      label: t("nav.debug"),
      icon: <Bug className="h-5 w-5" />,
      isActive: settingsCategory === "debug" && !settingsAccountId && !settingsAddAccount,
    },
  ];

  const accountItems: AccountNavItem[] = (accounts ?? []).map((account) => ({
    id: account.id,
    name: account.name,
    kind: account.kind,
    isActive: settingsAccountId === account.id,
  }));

  const handleSelectCategory = (categoryId: SettingsNavItemId) => {
    const nextCategory = settingsCategoryByNavId[categoryId];
    if (!nextCategory) return;
    setSettingsCategory(nextCategory);
  };

  return (
    <SettingsModalView
      open={settingsOpen}
      title={t("preferences")}
      closeLabel={t("close_preferences")}
      navigation={<SettingsNavView items={navItems} onSelectCategory={handleSelectCategory} />}
      accountsNavigation={
        <AccountsNavView
          accounts={accountItems}
          addAccountLabel={t("add_account_ellipsis")}
          isAddAccountActive={settingsAddAccount}
          onSelectAccount={setSettingsAccountId}
          onAddAccount={() => setSettingsAddAccount(true)}
        />
      }
      content={
        <SettingsContent
          settingsAccountId={settingsAccountId}
          settingsAddAccount={settingsAddAccount}
          settingsCategory={settingsCategory}
        />
      }
      isLoading={settingsLoading}
      onClose={closeSettings}
      onOpenChange={(open) => (!open ? closeSettings() : openSettings())}
    />
  );
}
