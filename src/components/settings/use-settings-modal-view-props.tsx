import type { TFunction } from "i18next";
import { BookOpen, Bug, Database, Palette, Settings, Share2 } from "lucide-react";
import type { ReactNode } from "react";
import type { AccountDto } from "@/api/tauri-commands";
import { AccountsNavView } from "@/components/settings/accounts-nav-view";
import type { SettingsModalViewProps } from "@/components/settings/settings-modal.types";
import type { AccountNavItem, SettingsNavItem, SettingsNavItemId } from "@/components/settings/settings-nav.types";
import { SettingsNavView } from "@/components/settings/settings-nav-view";
import type { SettingsCategory } from "@/stores/ui-store";

type UseSettingsModalViewPropsParams = {
  t: TFunction<"settings">;
  settingsOpen: boolean;
  settingsCategory: SettingsCategory;
  settingsAccountId: string | null;
  settingsAddAccount: boolean;
  settingsLoading: boolean;
  accounts: AccountDto[] | undefined;
  content: ReactNode;
  closeSettings: () => void;
  openSettings: () => void;
  setSettingsCategory: (category: SettingsCategory) => void;
  setSettingsAccountId: (accountId: string | null) => void;
  setSettingsAddAccount: (open: boolean) => void;
};

const settingsCategoryByNavId: Record<string, SettingsCategory> = {
  general: "general",
  appearance: "appearance",
  reading: "reading",
  shortcuts: "shortcuts",
  actions: "actions",
  data: "data",
  debug: "debug",
};

export function useSettingsModalViewProps({
  t,
  settingsOpen,
  settingsCategory,
  settingsAccountId,
  settingsAddAccount,
  settingsLoading,
  accounts,
  content,
  closeSettings,
  openSettings,
  setSettingsCategory,
  setSettingsAccountId,
  setSettingsAddAccount,
}: UseSettingsModalViewPropsParams): SettingsModalViewProps {
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
    if (!nextCategory) {
      return;
    }

    setSettingsCategory(nextCategory);
  };

  return {
    open: settingsOpen,
    title: t("preferences"),
    closeLabel: t("close_preferences"),
    navigation: <SettingsNavView items={navItems} onSelectCategory={handleSelectCategory} />,
    accountsHeading: t("accounts_heading"),
    accountsNavigation: (
      <AccountsNavView
        accounts={accountItems}
        addAccountLabel={t("add_account_ellipsis")}
        isAddAccountActive={settingsAddAccount}
        onSelectAccount={setSettingsAccountId}
        onAddAccount={() => setSettingsAddAccount(true)}
      />
    ),
    content,
    isLoading: settingsLoading,
    onClose: closeSettings,
    onOpenChange: (open) => (!open ? closeSettings() : openSettings()),
  };
}
