import type { ReactNode } from "react";

type SettingsModalContentScrollBehavior = "auto" | "always" | "never";
type SettingsModalOpenChangeHandler = (open: boolean) => void;

export type SettingsModalViewProps = {
  open: boolean;
  title: string;
  closeLabel: string;
  navigation: ReactNode;
  accountsHeading?: string;
  accountsNavigation: ReactNode;
  content: ReactNode;
  contentResetKey?: string;
  contentScrollBehavior?: SettingsModalContentScrollBehavior;
  isLoading?: boolean;
  isCloseDisabled?: boolean;
  lockMessage?: string;
  onClose: () => void;
  onOpenChange: SettingsModalOpenChangeHandler;
};
