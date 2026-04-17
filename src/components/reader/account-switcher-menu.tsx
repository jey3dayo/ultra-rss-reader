import type { RefObject } from "react";
import { NavRowButton } from "@/components/shared/nav-row-button";
import { cn } from "@/lib/utils";
import type { AccountSwitcherMenuProps } from "./account-switcher.types";

export function focusAccountItem(
  itemRefs: RefObject<Array<HTMLButtonElement | null>>,
  accountsLength: number,
  index: number,
) {
  if (accountsLength === 0) return;
  const normalizedIndex = (index + accountsLength) % accountsLength;
  itemRefs.current[normalizedIndex]?.focus();
}

export function AccountSwitcherMenu({
  accounts,
  accountStatusLabels,
  selectedAccountId,
  menuId,
  menuLabel,
  itemRefs,
  onSelectAccount,
  onClose,
}: AccountSwitcherMenuProps) {
  return (
    <div
      id={menuId}
      role="menu"
      aria-label={menuLabel}
      className="absolute top-full left-0 z-50 min-w-[200px] rounded-xl bg-surface-2/90 p-1 shadow-elevation-2"
      onKeyDown={(e) => {
        if (!accounts.length) return;

        const currentIndex = itemRefs.current.indexOf(document.activeElement as HTMLButtonElement);
        if (e.key === "Escape") {
          e.preventDefault();
          onClose(true);
        }
        if (e.key === "ArrowDown") {
          e.preventDefault();
          focusAccountItem(itemRefs, accounts.length, currentIndex >= 0 ? currentIndex + 1 : 0);
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          focusAccountItem(itemRefs, accounts.length, currentIndex >= 0 ? currentIndex - 1 : accounts.length - 1);
        }
      }}
    >
      {accounts.map((account, index) => {
        const statusLabel = accountStatusLabels?.[account.id];
        return (
          <NavRowButton
            key={account.id}
            tone="sidebar"
            ref={(element) => {
              itemRefs.current[index] = element;
            }}
            title={
              <div className="flex items-center gap-2">
                <span className="truncate">{account.name}</span>
                <span className="text-xs text-foreground-soft">{account.kind}</span>
              </div>
            }
            description={statusLabel ? <p className="text-xs text-foreground-soft">{statusLabel}</p> : undefined}
            selected={account.id === selectedAccountId}
            onClick={() => {
              onSelectAccount(account.id);
              onClose(false);
            }}
            role="menuitemradio"
            aria-checked={account.id === selectedAccountId}
            aria-pressed={account.id === selectedAccountId}
            className={cn(
              "w-full rounded-md px-3 py-2 text-left text-sm shadow-none focus-visible:ring-0",
              account.id === selectedAccountId
                ? "bg-[var(--sidebar-hover-surface)] text-sidebar-foreground hover:bg-[var(--sidebar-hover-surface)] focus-visible:bg-[var(--sidebar-hover-surface)]"
                : "text-sidebar-foreground/88 hover:bg-[var(--sidebar-hover-surface)] hover:text-sidebar-foreground focus-visible:bg-[var(--sidebar-hover-surface)] focus-visible:text-sidebar-foreground",
            )}
          />
        );
      })}
    </div>
  );
}
