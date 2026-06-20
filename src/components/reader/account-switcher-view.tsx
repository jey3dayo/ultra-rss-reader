import { ChevronDown } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode, Ref, RefObject } from "react";
import type { AccountDto } from "@/api/tauri-commands";
import { ContextMenu } from "@/design-system";
import { SIDEBAR_FALLBACK_TARGET_ATTRIBUTE } from "@/lib/reader-focus";
import { cn } from "@/lib/utils";
import { AccountSwitcherMenu } from "./account-switcher-menu";
import { useAccountSwitcherViewModel } from "./hooks/sidebar/use-sidebar-account-switcher";

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
  renderContextMenu?: () => ReactNode;
};

type AccountSwitcherTriggerButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "aria-controls" | "aria-expanded" | "aria-haspopup"
> & {
  accountName: string;
  canOpenAccountList: boolean;
  controlsId?: string;
  hasMultipleAccounts: boolean;
  isExpanded?: boolean;
  lastSyncedLabel: string;
  ref?: Ref<HTMLButtonElement>;
};

export function AccountSwitcherTriggerButton({
  accountName,
  canOpenAccountList,
  className,
  controlsId,
  hasMultipleAccounts,
  isExpanded = false,
  lastSyncedLabel,
  ref,
  type = "button",
  ...props
}: AccountSwitcherTriggerButtonProps) {
  return (
    <button
      ref={ref}
      type={type}
      {...{ [SIDEBAR_FALLBACK_TARGET_ATTRIBUTE]: "true" }}
      aria-haspopup={hasMultipleAccounts ? "menu" : undefined}
      aria-expanded={hasMultipleAccounts ? isExpanded : undefined}
      aria-controls={hasMultipleAccounts ? controlsId : undefined}
      className={cn(
        "group flex w-full flex-col items-start gap-1 rounded-xl text-left select-none transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 motion-reduce:transition-none",
        canOpenAccountList
          ? "cursor-pointer text-sidebar-foreground/92 hover:text-sidebar-foreground"
          : "cursor-default text-sidebar-foreground",
        className,
      )}
      {...props}
    >
      <h1 className="flex max-w-full items-end gap-1.5 text-[1.68rem] leading-[1.03] font-medium tracking-[-0.055em] text-current">
        {accountName}
        {hasMultipleAccounts ? (
          <ChevronDown className="mb-0.5 size-3.5 shrink-0 text-sidebar-foreground/56 transition-colors duration-200 group-hover:text-sidebar-foreground/78 motion-reduce:transition-none" />
        ) : null}
      </h1>
      <p className="text-[0.72rem] font-medium tracking-[0.04em] text-sidebar-foreground/54">{lastSyncedLabel}</p>
    </button>
  );
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
  renderContextMenu,
}: AccountSwitcherProps) {
  const { selectedAccountName, hasMultipleAccounts, canOpenAccountList } = useAccountSwitcherViewModel({
    accounts,
    selectedAccountId,
    isExpanded,
    itemRefs,
  });

  return (
    <div className="relative px-5 pt-4 pb-4">
      <ContextMenu.Root>
        <ContextMenu.Trigger
          render={
            <AccountSwitcherTriggerButton
              ref={triggerRef}
              accountName={selectedAccountName ?? title}
              canOpenAccountList={canOpenAccountList}
              controlsId={menuId}
              hasMultipleAccounts={hasMultipleAccounts}
              isExpanded={isExpanded}
              lastSyncedLabel={lastSyncedLabel}
            />
          }
          onClick={() => canOpenAccountList && onToggle()}
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
        />
        {renderContextMenu?.()}
      </ContextMenu.Root>

      {isExpanded && hasMultipleAccounts ? (
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
