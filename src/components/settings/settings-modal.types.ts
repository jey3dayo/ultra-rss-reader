import type { ReactNode } from "react";

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
