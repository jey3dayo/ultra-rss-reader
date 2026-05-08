import type { ReactNode } from "react";
import type { AddAccountProviderKind } from "@/lib/add-account-form";
import type { SettingsCategory } from "@/lib/ui-state.types";

export type SettingsContentProps = {
  settingsAccountId: string | null;
  settingsAddAccount: boolean;
  settingsAddAccountInitialKind: AddAccountProviderKind | null;
  settingsCategory: SettingsCategory;
};

export type SettingsModalViewProps = {
  open: boolean;
  title: string;
  closeLabel: string;
  navigation: ReactNode;
  accountsHeading?: string;
  accountsNavigation: ReactNode;
  content: ReactNode;
  contentResetKey?: string;
  contentScrollBehavior?: "auto" | "always" | "never";
  isLoading?: boolean;
  isCloseDisabled?: boolean;
  lockMessage?: string;
  onClose: () => void;
  onOpenChange: (open: boolean) => void;
};
