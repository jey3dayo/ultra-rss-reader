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
    <div className="relative px-5 pt-4 pb-4">
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
        className={cn(
          "group flex w-full flex-col items-start gap-0.5 rounded-xl text-left select-none transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
          hasMultipleAccounts
            ? "cursor-pointer text-sidebar-foreground/92 hover:text-sidebar-foreground"
            : "cursor-default text-sidebar-foreground",
        )}
        aria-haspopup={hasMultipleAccounts ? "menu" : undefined}
        aria-expanded={hasMultipleAccounts ? isExpanded : undefined}
        aria-controls={hasMultipleAccounts ? menuId : undefined}
      >
        <h1 className="flex max-w-full items-end gap-1.5 text-[1.68rem] leading-[0.95] font-normal tracking-[-0.055em] text-current">
          {selectedAccount?.name ?? title}
          {hasMultipleAccounts && (
            <ChevronDown className="mb-0.5 h-3.5 w-3.5 shrink-0 text-foreground-soft transition-colors duration-200 group-hover:text-sidebar-foreground" />
          )}
        </h1>
        <p className="text-[0.78rem] font-medium tracking-[0.01em] text-sidebar-foreground/58">{lastSyncedLabel}</p>
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
