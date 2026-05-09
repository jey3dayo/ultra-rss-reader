import type { ReactNode } from "react";
import type { SettingsCategory } from "@/lib/settings/settings-category.types";

type AccountNavSelectHandler = (accountId: string) => void;
type SettingsNavSelectHandler<TItemId extends string = SettingsNavItemId> = (categoryId: TItemId) => void;

export type AccountNavItem = {
  id: string;
  name: string;
  kind: string;
  username?: string | null;
  serverUrl?: string | null;
  isActive: boolean;
};

export type AccountsNavViewProps = {
  accounts: AccountNavItem[];
  addAccountLabel: string;
  isAddAccountActive: boolean;
  onSelectAccount: AccountNavSelectHandler;
  onAddAccount: () => void;
  disabled?: boolean;
};

export type SettingsNavItemId = Exclude<SettingsCategory, "accounts">;

export type SettingsNavItem<TItemId extends string = SettingsNavItemId> = {
  id: TItemId;
  label: string;
  icon: ReactNode;
  isActive: boolean;
};

export type SettingsNavViewProps<TItemId extends string = SettingsNavItemId> = {
  ariaLabel?: string;
  items: SettingsNavItem<TItemId>[];
  onSelectCategory: SettingsNavSelectHandler<TItemId>;
  disabled?: boolean;
};
