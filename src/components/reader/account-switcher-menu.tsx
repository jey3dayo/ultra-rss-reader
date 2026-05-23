import type { RefObject } from "react";
import type { AccountDto } from "@/api/tauri-commands";
import { focusAccountItem } from "@/components/reader/account-switcher-focus";
import { NavRowButton } from "@/components/shared/nav-row-button";
import { getActiveRovingButtonIndex } from "@/lib/dom/roving-focus";
import { focusSelectedSidebarTarget } from "@/lib/reader-focus";
import { cn } from "@/lib/utils";

type AccountSwitcherMenuProps = {
  accounts: AccountDto[];
  accountStatusLabels?: Record<string, string>;
  selectedAccountId: string | null;
  menuId: string;
  menuLabel: string;
  itemRefs: RefObject<Array<HTMLButtonElement | null>>;
  onSelectAccount: (accountId: string) => void;
  onClose: (restoreFocus: boolean) => void;
};

function shouldShowKindLabel(name: string, kind: string): boolean {
  return name.trim().toLocaleLowerCase() !== kind.trim().toLocaleLowerCase();
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
      data-account-switcher-menu="true"
      data-open=""
      data-side="bottom"
      aria-label={menuLabel}
      tabIndex={-1}
      className="motion-popup-surface absolute top-full left-0 z-50 min-w-[200px] rounded-xl bg-surface-2/90 p-1 shadow-elevation-2"
      onKeyDown={(e) => {
        if (!accounts.length) return;

        const currentIndex = getActiveRovingButtonIndex(itemRefs, document.activeElement);
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
        if (e.key === "ArrowRight") {
          e.preventDefault();
          onClose(false);
          requestAnimationFrame(() => {
            focusSelectedSidebarTarget();
          });
        }
      }}
    >
      {accounts.map((account, index) => {
        const statusLabel = accountStatusLabels?.[account.id];
        const showKindLabel = shouldShowKindLabel(account.name, account.kind);
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
                {showKindLabel ? <span className="text-xs text-foreground-soft">{account.kind}</span> : null}
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
