import type { RefObject } from "react";
import type { AccountSwitcherProps } from "./account-switcher-view";
import { AccountSwitcherView } from "./account-switcher-view";

type SidebarAccountSectionProps = AccountSwitcherProps & {
  containerRef: RefObject<HTMLDivElement | null>;
};

export function SidebarAccountSection({
  containerRef,
  title,
  lastSyncedLabel,
  accounts,
  accountStatusLabels,
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
        accountStatusLabels={accountStatusLabels}
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
