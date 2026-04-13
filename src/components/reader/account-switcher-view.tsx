import { ChevronDown } from "lucide-react";
import { useEffect } from "react";
import { cn } from "@/lib/utils";
import type { AccountSwitcherProps } from "./account-switcher.types";
import { AccountSwitcherMenu, focusAccountItem } from "./account-switcher-menu";

export function AccountSwitcherView({
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
}: AccountSwitcherProps) {
  const selectedAccount = accounts.find((account) => account.id === selectedAccountId);
  const hasMultipleAccounts = accounts.length > 1;

  useEffect(() => {
    if (!isExpanded || accounts.length === 0) return;

    requestAnimationFrame(() => {
      const selectedIndex = accounts.findIndex((account) => account.id === selectedAccountId);
      focusAccountItem(itemRefs, accounts.length, selectedIndex >= 0 ? selectedIndex : 0);
    });
  }, [accounts, isExpanded, itemRefs, selectedAccountId]);

  return (
    <div className="relative px-4 pb-1">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => hasMultipleAccounts && onToggle()}
        onKeyDown={(e) => {
          if (!hasMultipleAccounts) return;
          if (e.key === "ArrowDown" && !isExpanded) {
            e.preventDefault();
            onToggle();
          }
          if (e.key === "Escape" && isExpanded) {
            e.preventDefault();
            onClose(true);
          }
        }}
        className={cn("text-left", hasMultipleAccounts ? "cursor-pointer" : "cursor-default")}
        aria-haspopup={hasMultipleAccounts ? "menu" : undefined}
        aria-expanded={hasMultipleAccounts ? isExpanded : undefined}
        aria-controls={hasMultipleAccounts ? menuId : undefined}
      >
        <h1 className="flex items-center gap-1 text-2xl font-bold text-sidebar-foreground">
          {selectedAccount?.name ?? title}
          {hasMultipleAccounts && <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </h1>
        <p className="text-xs text-muted-foreground">{lastSyncedLabel}</p>
      </button>

      {isExpanded && accounts.length > 0 ? (
        <AccountSwitcherMenu
          accounts={accounts}
          accountStatusLabels={accountStatusLabels}
          selectedAccountId={selectedAccountId}
          menuId={menuId}
          menuLabel={menuLabel}
          itemRefs={itemRefs}
          onSelectAccount={onSelectAccount}
          onClose={onClose}
        />
      ) : null}
    </div>
  );
}
