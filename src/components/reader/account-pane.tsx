import { Check } from "lucide-react";
import { type KeyboardEvent as ReactKeyboardEvent, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useAccounts } from "@/hooks/use-accounts";
import {
  ACCOUNT_PANE_SELECTED_TARGET_ATTRIBUTE,
  focusSelectedAccountPaneTarget,
  focusSidebarSmartViewTargetWhenReady,
} from "@/lib/reader-focus";
import {
  ACCOUNT_PANE_ACCOUNT_ID_ATTRIBUTE,
  closeAccountPaneAndFocusSidebar,
  focusAdjacentAccountPaneTarget,
  normalizePaneNavigationKey,
  selectCurrentAccountPaneTargetAndFocusSidebar,
} from "@/lib/reader-pane-navigation";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/stores/ui-store";
import { useSidebarAccountStatusLabels } from "./use-sidebar-account-status-labels";

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
              <button
                key={account.id}
                ref={(element) => {
                  itemRefs.current[index] = element;
                }}
                type="button"
                data-account-pane-navigation-target="true"
                {...{ [ACCOUNT_PANE_ACCOUNT_ID_ATTRIBUTE]: account.id }}
                {...(selected ? { [ACCOUNT_PANE_SELECTED_TARGET_ATTRIBUTE]: "true" } : {})}
                {...(selected ? { "aria-current": "true" } : {})}
                data-active-pane={selected ? "true" : undefined}
                className={cn(
                  "motion-contextual-surface relative flex min-h-11 w-full flex-col items-start gap-0.5 rounded-md px-3 py-2 pr-9 text-left text-sm select-none transition-[background-color,color,box-shadow] duration-150 focus:outline-none motion-reduce:transition-none",
                  selected
                    ? "bg-[linear-gradient(90deg,var(--sidebar-selection-background)_0%,color-mix(in_srgb,var(--sidebar-selection-background)_84%,var(--sidebar-hover-surface))_100%)] text-sidebar-foreground shadow-[var(--sidebar-selection-shadow)] after:absolute after:inset-y-1.5 after:right-0 after:w-0.5 after:rounded-full after:bg-sidebar-foreground/48 focus-visible:bg-[linear-gradient(90deg,var(--sidebar-selection-background)_0%,color-mix(in_srgb,var(--sidebar-selection-background)_92%,var(--sidebar-hover-surface))_100%)] focus-visible:shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--sidebar-foreground)_18%,transparent)]"
                    : "text-sidebar-foreground/82 hover:bg-[var(--sidebar-hover-surface)] hover:text-sidebar-foreground focus-visible:bg-[linear-gradient(90deg,color-mix(in_srgb,var(--sidebar-hover-surface)_72%,transparent)_0%,color-mix(in_srgb,var(--sidebar-hover-surface)_34%,transparent)_100%)] focus-visible:text-sidebar-foreground focus-visible:shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--sidebar-foreground)_10%,transparent)]",
                )}
                onClick={() => {
                  selectAccount(account.id);
                  useUiStore.getState().setFocusedPane("sidebar");
                  focusSidebarSmartViewTargetWhenReady("unread");
                }}
              >
                <span className="flex max-w-full items-center gap-2">
                  <span className={cn("truncate", selected ? "font-semibold" : "font-medium")}>{account.name}</span>
                  {showKindLabel ? (
                    <span className="shrink-0 text-xs text-sidebar-foreground/54">{account.kind}</span>
                  ) : null}
                </span>
                {statusLabel ? (
                  <span className="max-w-full truncate text-xs text-sidebar-foreground/56">{statusLabel}</span>
                ) : null}
                {selected ? (
                  <Check
                    aria-hidden="true"
                    className="absolute top-1/2 right-3 size-4 -translate-y-1/2 text-sidebar-foreground/72"
                  />
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
