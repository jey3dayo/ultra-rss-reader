import type { ReactNode } from "react";
import type { SettingsCategory } from "@/stores/ui-store";

export type SettingsContentProps = {
  settingsAccountId: string | null;
  settingsAddAccount: boolean;
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
  contentScrollBehavior?: "auto" | "always" | "never";
  isLoading?: boolean;
  onClose: () => void;
  onOpenChange: (open: boolean) => void;
};
