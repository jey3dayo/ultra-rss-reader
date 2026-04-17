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
      className="absolute top-full left-0 z-50 min-w-[200px] rounded-2xl border border-border/45 bg-surface-2/96 p-1.5 shadow-elevation-3"
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
            tone="default"
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
              "relative w-full overflow-hidden rounded-md px-3 py-2 text-left text-sm shadow-none",
              account.id === selectedAccountId
                ? "border-transparent bg-surface-1/84 before:absolute before:inset-y-2 before:left-1.5 before:w-0.5 before:rounded-full before:bg-primary/55 hover:bg-surface-1/88"
                : "border-transparent text-foreground hover:bg-surface-1/64",
            )}
          />
        );
      })}
    </div>
  );
}
