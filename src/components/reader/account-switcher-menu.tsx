import type { RefObject } from "react";
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
      className="absolute top-full left-0 z-50 min-w-[180px] rounded-lg border border-border bg-sidebar p-1 shadow-lg"
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
          <button
            type="button"
            key={account.id}
            ref={(element) => {
              itemRefs.current[index] = element;
            }}
            onClick={() => {
              onSelectAccount(account.id);
              onClose(false);
            }}
            role="menuitemradio"
            aria-checked={account.id === selectedAccountId}
            className={cn(
              "flex w-full rounded-md px-3 py-2 text-left text-sm",
              account.id === selectedAccountId
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground hover:bg-sidebar-accent/50",
            )}
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="truncate">{account.name}</span>
                <span className="text-xs text-muted-foreground">{account.kind}</span>
              </div>
              {statusLabel ? <p className="text-xs text-muted-foreground">{statusLabel}</p> : null}
            </div>
          </button>
        );
      })}
    </div>
  );
}
