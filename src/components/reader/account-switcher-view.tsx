import { ChevronDown } from "lucide-react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation("sidebar");
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
        className={cn("select-none text-left", hasMultipleAccounts ? "cursor-pointer" : "cursor-default")}
        aria-haspopup={hasMultipleAccounts ? "menu" : undefined}
        aria-expanded={hasMultipleAccounts ? isExpanded : undefined}
        aria-controls={hasMultipleAccounts ? menuId : undefined}
      >
        <span className="mb-1 inline-flex rounded-full border border-[var(--sidebar-frame-border)] bg-[var(--sidebar-frame-surface)] px-2.5 py-1 text-[0.64rem] font-medium tracking-[0.14em] text-foreground-soft uppercase">
          {t("workspace_label")}
        </span>
        <h1 className="flex items-center gap-1 text-[2rem] font-semibold tracking-[-0.04em] text-sidebar-foreground">
          {selectedAccount?.name ?? title}
          {hasMultipleAccounts && <ChevronDown className="h-4 w-4 text-foreground-soft" />}
        </h1>
        <p className="mt-1 text-xs text-foreground-soft">{lastSyncedLabel}</p>
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
