import type { TFunction } from "i18next";
import { BellOff, BookOpen, Bug, Command, Database, Palette, Settings, Share2, Tag } from "lucide-react";
import type { ReactNode } from "react";
import type { AccountDto } from "@/api/tauri-commands";
import { AccountsNavView } from "@/components/settings/accounts-nav-view";
import type { SettingsModalViewProps } from "@/components/settings/settings-modal.types";
import type { AccountNavItem, SettingsNavItem, SettingsNavItemId } from "@/components/settings/settings-nav.types";
import { SettingsNavView } from "@/components/settings/settings-nav-view";
import type { AddAccountProviderKind } from "@/lib/add-account-form";
import type { SettingsCategory } from "@/lib/ui-state.types";

type SettingsModalTranslator = TFunction<"settings"> | ((key: string) => string);

type UseSettingsModalViewPropsParams = {
  t: SettingsModalTranslator;
  devBuild: boolean;
  settingsOpen: boolean;
  settingsCategory: SettingsCategory;
  settingsAccountId: string | null;
  settingsAddAccount: boolean;
  settingsAddAccountInitialKind: AddAccountProviderKind | null;
  settingsLoading: boolean;
  accounts: AccountDto[] | undefined;
  content: ReactNode;
  closeSettings: () => void;
  openSettings: () => void;
  setSettingsCategory: (category: SettingsCategory) => void;
  openSettingsAccount: (accountId: string) => void;
  openSettingsAddAccount: (initialKind?: AddAccountProviderKind) => void;
  setupLockReason?: string | null;
};

const settingsCategoryByNavId: Record<string, SettingsCategory> = {
  general: "general",
  reading: "reading",
  appearance: "appearance",
  mute: "mute",
  tags: "tags",
  shortcuts: "shortcuts",
  actions: "actions",
  data: "data",
  debug: "debug",
};

export function useSettingsModalViewProps({
  t,
  devBuild,
  settingsOpen,
  settingsCategory,
  settingsAccountId,
  settingsAddAccount,
  settingsAddAccountInitialKind,
  settingsLoading,
  accounts,
  content,
  closeSettings,
  openSettings,
  setSettingsCategory,
  openSettingsAccount,
  openSettingsAddAccount,
  setupLockReason,
}: UseSettingsModalViewPropsParams): SettingsModalViewProps {
  const setupLocked = Boolean(setupLockReason);
  const navItems: SettingsNavItem[] = [
    {
      id: "general",
      label: t("nav.general"),
      icon: <Settings className="h-5 w-5" />,
      isActive: settingsCategory === "general" && !settingsAccountId && !settingsAddAccount,
    },
    {
      id: "reading",
      label: t("nav.reading"),
      icon: <BookOpen className="h-5 w-5" />,
      isActive: settingsCategory === "reading" && !settingsAccountId && !settingsAddAccount,
    },
    {
      id: "appearance",
      label: t("nav.appearance"),
      icon: <Palette className="h-5 w-5" />,
      isActive: settingsCategory === "appearance" && !settingsAccountId && !settingsAddAccount,
    },
    {
      id: "mute",
      label: t("nav.mute"),
      icon: <BellOff className="h-5 w-5" />,
      isActive: settingsCategory === "mute" && !settingsAccountId && !settingsAddAccount,
    },
    {
      id: "tags",
      label: t("nav.tags"),
      icon: <Tag className="h-5 w-5" />,
      isActive: settingsCategory === "tags" && !settingsAccountId && !settingsAddAccount,
    },
    {
      id: "shortcuts",
      label: t("nav.shortcuts"),
      icon: <Command className="h-5 w-5" />,
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
  ];

  if (devBuild) {
    navItems.push({
      id: "debug",
      label: t("nav.debug"),
      icon: <Bug className="h-5 w-5" />,
      isActive: settingsCategory === "debug" && !settingsAccountId && !settingsAddAccount,
    });
  }

  const accountItems: AccountNavItem[] = (accounts ?? []).map((account) => ({
    id: account.id,
    name: account.name,
    kind: account.kind,
    username: account.username,
    serverUrl: account.server_url,
    isActive: settingsAccountId === account.id,
  }));

  const handleSelectCategory = (categoryId: SettingsNavItemId) => {
    if (setupLocked) {
      return;
    }
    const nextCategory = settingsCategoryByNavId[categoryId];
    if (!nextCategory) {
      return;
    }

    setSettingsCategory(nextCategory);
  };

  const handleSelectAccount = (accountId: string) => {
    if (setupLocked) {
      return;
    }
    openSettingsAccount(accountId);
  };

  const handleAddAccount = () => {
    if (setupLocked) {
      return;
    }
    openSettingsAddAccount();
  };

  return {
    open: settingsOpen,
    title: t("preferences"),
    closeLabel: t("close_preferences"),
    navigation: <SettingsNavView items={navItems} onSelectCategory={handleSelectCategory} disabled={setupLocked} />,
    accountsHeading: t("accounts_heading"),
    accountsNavigation: (
      <AccountsNavView
        accounts={accountItems}
        addAccountLabel={t("add_account_ellipsis")}
        isAddAccountActive={settingsAddAccount}
        onSelectAccount={handleSelectAccount}
        onAddAccount={handleAddAccount}
        disabled={setupLocked}
      />
    ),
    content,
    contentResetKey: `${settingsCategory}:${settingsAccountId ?? ""}:${settingsAddAccount ? `add:${settingsAddAccountInitialKind ?? "pick"}` : "browse"}`,
    isLoading: settingsLoading,
    isCloseDisabled: setupLocked,
    lockMessage: setupLockReason ?? undefined,
    onClose: () => {
      if (setupLocked) {
        return;
      }
      closeSettings();
    },
    onOpenChange: (open) => {
      if (!open) {
        if (setupLocked) {
          return;
        }
        closeSettings();
        return;
      }
      openSettings();
    },
  };
}
