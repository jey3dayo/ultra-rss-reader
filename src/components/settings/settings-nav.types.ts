import type { ReactNode } from "react";

export type AccountNavItem = {
  id: string;
  name: string;
  kind: string;
  isActive: boolean;
};

export type AccountsNavViewProps = {
  accounts: AccountNavItem[];
  addAccountLabel: string;
  isAddAccountActive: boolean;
  onSelectAccount: (accountId: string) => void;
  onAddAccount: () => void;
};

export type SettingsNavItemId = string;

export type SettingsNavItem = {
  id: SettingsNavItemId;
  label: string;
  icon: ReactNode;
  isActive: boolean;
};

export type SettingsNavViewProps = {
  ariaLabel?: string;
  items: SettingsNavItem[];
  onSelectCategory: (categoryId: SettingsNavItemId) => void;
};
