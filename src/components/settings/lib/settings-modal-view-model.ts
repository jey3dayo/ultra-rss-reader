import type { AccountDto } from "@/api/tauri-commands";
import type { AccountNavItem } from "@/components/settings/accounts-nav.types";
import type { SettingsNavItemId } from "@/components/settings/settings-nav.types";
import type { AddAccountProviderKind } from "@/lib/account/add-account-form";
import type { SettingsCategory } from "@/lib/settings/settings-category.types";

type SettingsModalTranslator = (key: string) => string;

export type SettingsNavItemModel = {
  id: SettingsNavItemId;
  label: string;
  isActive: boolean;
};

export const settingsCategoryByNavId: Record<SettingsNavItemId, SettingsCategory> = {
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

const settingsNavItemIds: readonly SettingsNavItemId[] = [
  "general",
  "reading",
  "appearance",
  "mute",
  "tags",
  "shortcuts",
  "actions",
  "data",
];

export function buildSettingsContentResetKey({
  settingsCategory,
  settingsAccountId,
  settingsAddAccount,
  settingsAddAccountInitialKind,
}: {
  settingsCategory: SettingsCategory;
  settingsAccountId: string | null;
  settingsAddAccount: boolean;
  settingsAddAccountInitialKind: AddAccountProviderKind | null;
}): string {
  return JSON.stringify({
    category: settingsCategory,
    accountId: settingsAccountId,
    mode: settingsAddAccount
      ? { type: "add", initialKind: settingsAddAccountInitialKind ?? "pick" }
      : { type: "browse" },
  });
}

export function buildSettingsNavItemModels({
  t,
  devBuild,
  settingsCategory,
  settingsAccountId,
  settingsAddAccount,
}: {
  t: SettingsModalTranslator;
  devBuild: boolean;
  settingsCategory: SettingsCategory;
  settingsAccountId: string | null;
  settingsAddAccount: boolean;
}): SettingsNavItemModel[] {
  const itemIds = devBuild ? [...settingsNavItemIds, "debug" as const] : [...settingsNavItemIds];

  return itemIds.map((id) => ({
    id,
    label: t(`nav.${id}`),
    isActive: settingsCategory === settingsCategoryByNavId[id] && !settingsAccountId && !settingsAddAccount,
  }));
}

export function buildAccountNavItems({
  accounts,
  settingsAccountId,
}: {
  accounts: AccountDto[] | undefined;
  settingsAccountId: string | null;
}): AccountNavItem[] {
  return (accounts ?? []).map((account) => ({
    id: account.id,
    name: account.name,
    kind: account.kind,
    username: account.username,
    serverUrl: account.server_url,
    isActive: settingsAccountId === account.id,
  }));
}
