import { ChevronDown } from "lucide-react";
import type { RefObject } from "react";
import { useEffect } from "react";
import type { AccountDto } from "@/api/tauri-commands";
import { cn } from "@/lib/utils";

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

function focusAccountItem(itemRefs: RefObject<Array<HTMLButtonElement | null>>, accountsLength: number, index: number) {
  if (accountsLength === 0) return;
  const normalizedIndex = (index + accountsLength) % accountsLength;
  itemRefs.current[normalizedIndex]?.focus();
}

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

      {isExpanded && accounts.length > 0 && (
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
          {accounts.map((account, index) =>
            (() => {
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
            })(),
          )}
        </div>
      )}
    </div>
  );
}
