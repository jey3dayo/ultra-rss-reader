import type { ReactNode } from "react";
import type { SettingsCategory } from "@/lib/settings/settings-category.types";

type SettingsNavSelectHandler<TItemId extends string = SettingsNavItemId> = (categoryId: TItemId) => void;

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
