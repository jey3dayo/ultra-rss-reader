import type { RefObject } from "react";
import type { AccountDto } from "@/api/tauri-commands";
import { AccountSwitcherView } from "./account-switcher-view";

type SidebarAccountSectionProps = {
  containerRef: RefObject<HTMLDivElement | null>;
  title: string;
  lastSyncedLabel: string;
  accounts: AccountDto[];
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

export function SidebarAccountSection({
  containerRef,
  title,
  lastSyncedLabel,
  accounts,
  selectedAccountId,
  isExpanded,
  menuId,
  menuLabel,
  triggerRef,
  itemRefs,
  onToggle,
  onSelectAccount,
  onClose,
}: SidebarAccountSectionProps) {
  return (
    <div ref={containerRef}>
      <AccountSwitcherView
        title={title}
        lastSyncedLabel={lastSyncedLabel}
        accounts={accounts}
        selectedAccountId={selectedAccountId}
        isExpanded={isExpanded}
        menuId={menuId}
        menuLabel={menuLabel}
        triggerRef={triggerRef}
        itemRefs={itemRefs}
        onToggle={onToggle}
        onSelectAccount={onSelectAccount}
        onClose={onClose}
      />
    </div>
  );
}
