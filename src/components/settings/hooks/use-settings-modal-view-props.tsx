import type { TFunction } from "i18next";
import { BellOff, BookOpen, Bug, Command, Database, Palette, Settings, Share2, Tag } from "lucide-react";
import type { ReactNode } from "react";
import type { AccountDto } from "@/api/tauri-commands";
import { AccountsNavView } from "@/components/settings/accounts-nav-view";
import {
  buildAccountNavItems,
  buildSettingsContentResetKey,
  buildSettingsNavItemModels,
  type SettingsNavItemModel,
  settingsCategoryByNavId,
} from "@/components/settings/lib/settings-modal-view-model";
import type { SettingsModalViewProps } from "@/components/settings/settings-modal-view";
import { type SettingsNavItem, type SettingsNavItemId, SettingsNavView } from "@/components/settings/settings-nav-view";
import type { AddAccountProviderKind } from "@/lib/account/add-account-form";
import type { SettingsCategory } from "@/lib/settings/settings-category.types";

type SettingsModalTranslator = TFunction<"settings"> | ((key: string) => string);

type UseSettingsModalViewPropsParams = {
  t: SettingsModalTranslator;
  settingsOpen: boolean;
  settingsCategory: SettingsCategory;
  settingsAccountId: string | null;
  settingsAddAccount: boolean;
  settingsAddAccountInitialKind: AddAccountProviderKind | null;
  settingsLoading: boolean;
  accounts: AccountDto[] | undefined;
  content: ReactNode;
  footer?: ReactNode;
  guardLeave?: (leave: () => void) => void;
  leaveConfirmation?: ReactNode;
  closeSettings: () => void;
  openSettings: () => void;
  setSettingsCategory: (category: SettingsCategory) => void;
  openSettingsAccount: (accountId: string) => void;
  openSettingsAddAccount: (initialKind?: AddAccountProviderKind) => void;
  setupLockReason?: string | null;
};

const settingsNavIcons: Record<SettingsNavItemId, ReactNode> = {
  general: <Settings className="size-5" />,
  reading: <BookOpen className="size-5" />,
  appearance: <Palette className="size-5" />,
  mute: <BellOff className="size-5" />,
  tags: <Tag className="size-5" />,
  shortcuts: <Command className="size-5" />,
  actions: <Share2 className="size-5" />,
  data: <Database className="size-5" />,
  debug: <Bug className="size-5" />,
};

function attachSettingsNavIcons(item: SettingsNavItemModel): SettingsNavItem {
  return {
    ...item,
    icon: settingsNavIcons[item.id],
  };
}

export function useSettingsModalViewProps({
  t,
  settingsOpen,
  settingsCategory,
  settingsAccountId,
  settingsAddAccount,
  settingsAddAccountInitialKind,
  settingsLoading,
  accounts,
  content,
  footer,
  guardLeave = (leave) => leave(),
  leaveConfirmation,
  closeSettings,
  openSettings,
  setSettingsCategory,
  openSettingsAccount,
  openSettingsAddAccount,
  setupLockReason,
}: UseSettingsModalViewPropsParams): SettingsModalViewProps {
  const setupLocked = Boolean(setupLockReason);
  const translateNavLabel = (key: string) => String(t(key));
  const navItems = buildSettingsNavItemModels({
    t: translateNavLabel,
    settingsCategory,
    settingsAccountId,
    settingsAddAccount,
  }).map(attachSettingsNavIcons);

  const accountItems = buildAccountNavItems({ accounts, settingsAccountId });

  const handleSelectCategory = (categoryId: SettingsNavItemId) => {
    if (setupLocked) {
      return;
    }

    const nextCategory = settingsCategoryByNavId[categoryId];
    if (nextCategory === settingsCategory && !settingsAddAccount && settingsAccountId === null) {
      setSettingsCategory(nextCategory);
      return;
    }
    guardLeave(() => setSettingsCategory(nextCategory));
  };

  const handleSelectAccount = (accountId: string) => {
    if (setupLocked) {
      return;
    }
    if (accountId === settingsAccountId) {
      openSettingsAccount(accountId);
      return;
    }
    guardLeave(() => openSettingsAccount(accountId));
  };

  const handleAddAccount = () => {
    if (setupLocked) {
      return;
    }
    guardLeave(() => openSettingsAddAccount());
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
    footer,
    leaveConfirmation,
    contentResetKey: buildSettingsContentResetKey({
      settingsCategory,
      settingsAccountId,
      settingsAddAccount,
      settingsAddAccountInitialKind,
    }),
    isLoading: settingsLoading,
    isCloseDisabled: setupLocked,
    lockMessage: setupLockReason ?? undefined,
    onClose: () => {
      if (setupLocked) {
        return;
      }
      guardLeave(closeSettings);
    },
    onOpenChange: (open) => {
      if (!open) {
        if (setupLocked) {
          return;
        }
        guardLeave(closeSettings);
        return;
      }
      openSettings();
    },
  };
}
