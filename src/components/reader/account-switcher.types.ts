import type { RefObject } from "react";
import type { AccountDto } from "@/api/tauri-commands";

export type AccountSwitcherProps = {
  title: string;
  lastSyncedLabel: string;
  accounts: AccountDto[];
  accountStatusLabels?: Record<string, string>;
  selectedAccountId: string | null;
  isExpanded: boolean;
  menuId: string;
  menuLabel: string;
  triggerRef: RefObject<HTMLButtonElement | null>;
  itemRefs: RefObject<Array<HTMLButtonElement | null>>;
  onToggle: () => void;
  onSelectAccount: (accountId: string) => void;
  onClose: (restoreFocus: boolean) => void;
};

export type AccountSwitcherMenuProps = Pick<
  AccountSwitcherProps,
  | "accounts"
  | "accountStatusLabels"
  | "selectedAccountId"
  | "menuId"
  | "menuLabel"
  | "itemRefs"
  | "onSelectAccount"
  | "onClose"
>;
