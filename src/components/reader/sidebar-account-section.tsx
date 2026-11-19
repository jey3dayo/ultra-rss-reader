import { Plus } from "lucide-react";
import type { RefObject } from "react";
import { NavRowButton } from "@/design-system";
import { type AccountSwitcherProps, AccountSwitcherView } from "./account-switcher-view";

export type SidebarAccountSectionProps = AccountSwitcherProps & {
  containerRef: RefObject<HTMLDivElement | null>;
  addAccountLabel: string;
  onAddAccount: () => void;
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
  renderContextMenu,
  addAccountLabel,
  onAddAccount,
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
        renderContextMenu={renderContextMenu}
      />
      <div className="px-3 pb-3">
        <NavRowButton
          tone="sidebar"
          title={addAccountLabel}
          leading={<Plus aria-hidden="true" className="size-4" />}
          onClick={() => onAddAccount()}
          className="min-h-11 items-center gap-2 text-sm"
        />
      </div>
    </div>
  );
}
