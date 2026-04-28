import { type KeyboardEvent as ReactKeyboardEvent, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useAccounts } from "@/hooks/use-accounts";
import {
  ACCOUNT_PANE_SELECTED_TARGET_ATTRIBUTE,
  focusSelectedAccountPaneTarget,
  focusSelectedSidebarTarget,
} from "@/lib/reader-focus";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/stores/ui-store";
import { focusRovingButton } from "./roving-focus";
import { useSidebarAccountStatusLabels } from "./use-sidebar-account-status-labels";

function shouldShowKindLabel(name: string, kind: string): boolean {
  return name.trim().toLocaleLowerCase() !== kind.trim().toLocaleLowerCase();
}

function closePaneAndFocusSidebar() {
  useUiStore.getState().closeAccountPane();
  requestAnimationFrame(() => {
    focusSelectedSidebarTarget();
  });
}

export function AccountPane() {
  const { t } = useTranslation("sidebar");
  const { data: accounts = [] } = useAccounts();
  const accountStatusLabels = useSidebarAccountStatusLabels(accounts);
  const selectedAccountId = useUiStore((state) => state.selectedAccountId);
  const accountPaneOpen = useUiStore((state) => state.accountPaneOpen);
  const selectAccount = useUiStore((state) => state.selectAccount);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

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

    const currentIndex = itemRefs.current.indexOf(document.activeElement as HTMLButtonElement);

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      event.stopPropagation();
      const direction = event.key === "ArrowDown" ? 1 : -1;
      focusRovingButton(itemRefs, accounts.length, currentIndex >= 0 ? currentIndex + direction : 0);
      return;
    }

    if (event.key === "ArrowRight" || event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      closePaneAndFocusSidebar();
      return;
    }

    if (event.key === "Enter") {
      const account = accounts[currentIndex];
      if (!account) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      selectAccount(account.id);
      useUiStore.getState().setFocusedPane("sidebar");
      requestAnimationFrame(() => {
        focusSelectedSidebarTarget();
      });
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
              <button
                key={account.id}
                ref={(element) => {
                  itemRefs.current[index] = element;
                }}
                type="button"
                data-account-pane-navigation-target="true"
                {...(selected ? { [ACCOUNT_PANE_SELECTED_TARGET_ATTRIBUTE]: "true" } : {})}
                data-active-pane={selected ? "true" : undefined}
                className={cn(
                  "motion-contextual-surface relative flex w-full flex-col items-start gap-0.5 rounded-md px-3 py-2 text-left text-sm select-none transition-[background-color,color,box-shadow] duration-150 focus:outline-none",
                  selected
                    ? "bg-[linear-gradient(90deg,var(--sidebar-selection-background)_0%,color-mix(in_srgb,var(--sidebar-selection-background)_68%,var(--sidebar-hover-surface))_100%)] text-[var(--sidebar-selection-foreground)] before:absolute before:inset-y-1.5 before:left-0 before:w-0.5 before:rounded-full before:bg-primary/85 focus-visible:bg-[linear-gradient(90deg,var(--sidebar-selection-background)_0%,color-mix(in_srgb,var(--sidebar-selection-background)_68%,var(--sidebar-hover-surface))_100%)]"
                    : "text-sidebar-foreground/88 hover:bg-[var(--sidebar-hover-surface)] hover:text-sidebar-foreground focus-visible:bg-[linear-gradient(90deg,var(--sidebar-hover-surface)_0%,color-mix(in_srgb,var(--sidebar-hover-surface)_58%,transparent)_100%)] focus-visible:text-sidebar-foreground",
                )}
                onClick={() => {
                  selectAccount(account.id);
                  useUiStore.getState().setFocusedPane("sidebar");
                  requestAnimationFrame(() => {
                    focusSelectedSidebarTarget();
                  });
                }}
              >
                <span className="flex max-w-full items-center gap-2">
                  <span className="truncate font-medium">{account.name}</span>
                  {showKindLabel ? (
                    <span className="shrink-0 text-xs text-sidebar-foreground/54">{account.kind}</span>
                  ) : null}
                </span>
                {statusLabel ? (
                  <span className="max-w-full truncate text-xs text-sidebar-foreground/56">{statusLabel}</span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
