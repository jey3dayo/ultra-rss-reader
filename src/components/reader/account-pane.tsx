import { cn } from "cn";
import { Plus } from "lucide-react";
import { type KeyboardEvent as ReactKeyboardEvent, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useSidebarAccountStatusLabels } from "@/components/reader/hooks/sidebar/use-sidebar-account-status-labels";
import { NavRowButton } from "@/design-system";
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
  scheduleReaderFocusFrame,
} from "@/lib/reader-focus";
import { hasTauriRuntime, shouldUseDesktopOverlayTitlebar } from "@/lib/window/window-chrome";
import { usePlatformStore } from "@/stores/platform-store";
import { useUiStore } from "@/stores/ui-store";
import { AccountContextMenuTrigger } from "./account-context-menu-trigger";
import { shouldShowKindLabel } from "./account-kind-label";
import { SidebarNavButton } from "./sidebar-nav-button";

export function AccountPane() {
  const { t } = useTranslation("sidebar");
  const { data: accounts = [] } = useAccounts();
  const accountStatusLabels = useSidebarAccountStatusLabels(accounts);
  const selectedAccountId = useUiStore((state) => state.selectedAccountId);
  const accountPaneOpen = useUiStore((state) => state.accountPaneOpen);
  const platformKind = usePlatformStore((state) => state.platform.kind);
  const useDesktopOverlay = shouldUseDesktopOverlayTitlebar({ platformKind, hasTauriRuntime: hasTauriRuntime() });
  const selectAccount = useUiStore((state) => state.selectAccount);
  const openSettingsAddAccount = useUiStore((state) => state.openSettingsAddAccount);
  useEffect(() => {
    if (!accountPaneOpen || accounts.length === 0) {
      return;
    }

    const cleanupFocusFrame = scheduleReaderFocusFrame(() => {
      if (accountPaneOpen) {
        focusSelectedAccountPaneTarget();
      }
    });

    return cleanupFocusFrame;
  }, [accountPaneOpen, accounts.length]);

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.defaultPrevented || accounts.length === 0) {
      return;
    }

    const key = normalizePaneNavigationKey(event.key);
    if (!key) {
      return;
    }

    if (key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      closeAccountPaneAndFocusSidebar();
      return;
    }

    const accountTarget =
      event.target instanceof Element ? event.target.closest(`[${ACCOUNT_PANE_ACCOUNT_ID_ATTRIBUTE}]`) : null;
    if (!accountTarget) {
      return;
    }

    if (key === "ArrowDown" || key === "ArrowUp") {
      event.preventDefault();
      event.stopPropagation();
      focusAdjacentAccountPaneTarget(key === "ArrowDown" ? 1 : -1);
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    selectCurrentAccountPaneTargetAndFocusSidebar();
  };

  return (
    <nav
      aria-label={t("accounts")}
      data-account-pane="true"
      className="flex h-full flex-col border-r border-border bg-sidebar text-sidebar-foreground"
      onKeyDown={handleKeyDown}
    >
      <div
        className={cn("px-4 pb-3", useDesktopOverlay ? "pt-[calc(var(--desktop-titlebar-offset)+0.75rem)]" : "pt-4")}
      >
        <p className="system-micro text-sidebar-foreground/54">{t("accounts")}</p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        <div className="space-y-1">
          {accounts.map((account) => {
            const selected = account.id === selectedAccountId;
            const statusLabel = accountStatusLabels[account.id];
            const showKindLabel = shouldShowKindLabel(account.name, account.kind);

            return (
              <AccountContextMenuTrigger
                key={account.id}
                accountId={account.id}
                onSelect={() => {
                  selectAccount(account.id);
                  useUiStore.getState().setFocusedPane("sidebar");
                  focusSidebarSmartViewTargetWhenReady("unread");
                }}
                render={
                  <SidebarNavButton
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
                  >
                    <span className="flex max-w-full items-center gap-2 pl-1.5">
                      <span className={cn("truncate", selected ? "font-semibold" : "font-medium")}>{account.name}</span>
                      {showKindLabel ? (
                        <span className="shrink-0 text-xs text-sidebar-foreground/54">{account.kind}</span>
                      ) : null}
                    </span>
                    {statusLabel ? (
                      <span className="max-w-full truncate pl-1.5 text-xs text-sidebar-foreground/56">
                        {statusLabel}
                      </span>
                    ) : null}
                  </SidebarNavButton>
                }
              />
            );
          })}
        </div>
      </div>
      <div className="px-2 pb-3">
        <NavRowButton
          tone="sidebar"
          title={t("add_account_to_start")}
          leading={<Plus aria-hidden="true" className="size-4" />}
          onClick={() => openSettingsAddAccount()}
          className="min-h-11 items-center gap-2 text-sm"
        />
      </div>
    </nav>
  );
}
