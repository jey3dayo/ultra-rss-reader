import { type KeyboardEvent as ReactKeyboardEvent, type RefCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useSidebarAccountStatusLabels } from "@/components/reader/hooks/sidebar/use-sidebar-account-status-labels";
import { useAccounts } from "@/hooks/use-accounts";
import {
  ACCOUNT_PANE_ACCOUNT_ID_ATTRIBUTE,
  closeAccountPaneAndFocusSidebar,
  focusAdjacentAccountPaneTarget,
  normalizePaneNavigationKey,
  selectCurrentAccountPaneTargetAndFocusSidebar,
} from "@/lib/account/account-pane-navigation";
import {
  ACCOUNT_PANE_NAVIGATION_TARGET_ATTRIBUTE,
  ACCOUNT_PANE_SELECTED_TARGET_ATTRIBUTE,
  focusSelectedAccountPaneTarget,
  focusSidebarSmartViewTargetWhenReady,
} from "@/lib/reader-focus";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/stores/ui-store";
import { SidebarNavButton } from "./sidebar-nav-button";

function shouldShowKindLabel(name: string, kind: string): boolean {
  return name.trim().toLocaleLowerCase() !== kind.trim().toLocaleLowerCase();
}

export function AccountPane() {
  const { t } = useTranslation("sidebar");
  const { data: accounts = [] } = useAccounts();
  const accountStatusLabels = useSidebarAccountStatusLabels(accounts);
  const selectedAccountId = useUiStore((state) => state.selectedAccountId);
  const accountPaneOpen = useUiStore((state) => state.accountPaneOpen);
  const selectAccount = useUiStore((state) => state.selectAccount);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const setAccountItemRef =
    (index: number): RefCallback<HTMLButtonElement> =>
    (element) => {
      itemRefs.current[index] = element;
    };

  useEffect(() => {
    if (!accountPaneOpen) {
      return;
    }

    requestAnimationFrame(() => {
      focusSelectedAccountPaneTarget();
    });
  }, [accountPaneOpen]);

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.defaultPrevented || accounts.length === 0) {
      return;
    }

    const key = normalizePaneNavigationKey(event.key);
    if (!key) {
      return;
    }

    if (key === "ArrowDown" || key === "ArrowUp") {
      event.preventDefault();
      event.stopPropagation();
      focusAdjacentAccountPaneTarget(key === "ArrowDown" ? 1 : -1);
      return;
    }

    if (key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      closeAccountPaneAndFocusSidebar();
      return;
    }

    if (key === "Enter" || key === "ArrowRight") {
      event.preventDefault();
      event.stopPropagation();
      selectCurrentAccountPaneTargetAndFocusSidebar();
    }
  };

  return (
    <nav
      aria-label={t("accounts")}
      data-account-pane="true"
      className="flex h-full flex-col border-r border-border bg-sidebar text-sidebar-foreground"
      onKeyDown={handleKeyDown}
    >
      <div className="px-4 pt-4 pb-3">
        <p className="text-[0.68rem] font-medium tracking-[0.12em] text-sidebar-foreground/54 uppercase">
          {t("accounts")}
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        <div className="space-y-1">
          {accounts.map((account, index) => {
            const selected = account.id === selectedAccountId;
            const statusLabel = accountStatusLabels[account.id];
            const showKindLabel = shouldShowKindLabel(account.name, account.kind);

            return (
              <SidebarNavButton
                key={account.id}
                ref={setAccountItemRef(index)}
                {...{ [ACCOUNT_PANE_NAVIGATION_TARGET_ATTRIBUTE]: "true" }}
                {...{ [ACCOUNT_PANE_ACCOUNT_ID_ATTRIBUTE]: account.id }}
                {...(selected ? { [ACCOUNT_PANE_SELECTED_TARGET_ATTRIBUTE]: "true" } : {})}
                {...(selected ? { "aria-current": "true" } : {})}
                selected={selected}
                activePane={true}
                registerSidebarNavigationTarget={false}
                selectedIndicatorTone="neutral"
                size="default"
                contentClassName="flex-col items-start gap-0.5"
                className={cn(
                  "rounded-md px-3 text-left",
                  selected &&
                    "focus-visible:shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--sidebar-foreground)_14%,transparent)]",
                )}
                onClick={() => {
                  selectAccount(account.id);
                  useUiStore.getState().setFocusedPane("sidebar");
                  focusSidebarSmartViewTargetWhenReady("unread");
                }}
              >
                <span className="flex max-w-full items-center gap-2 pl-1.5">
                  <span className={cn("truncate", selected ? "font-semibold" : "font-medium")}>{account.name}</span>
                  {showKindLabel ? (
                    <span className="shrink-0 text-xs text-sidebar-foreground/54">{account.kind}</span>
                  ) : null}
                </span>
                {statusLabel ? (
                  <span className="max-w-full truncate pl-1.5 text-xs text-sidebar-foreground/56">{statusLabel}</span>
                ) : null}
              </SidebarNavButton>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
