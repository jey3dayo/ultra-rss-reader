import { type ReactElement, type MouseEvent as ReactMouseEvent, useRef } from "react";
import { useTranslation } from "react-i18next";
import { ContextMenu } from "@/design-system/context-menu";
import { useUiStore } from "@/stores/ui-store";
import { AccountContextMenuContent } from "./account-context-menu";

type AccountContextMenuTriggerProps = {
  accountId: string;
  onSelect?: () => void;
  render: ReactElement;
};

/**
 * Account pane row wiring: mirrors FeedContextMenuTrigger. Some webviews emit
 * `click` alongside `contextmenu` (macOS ctrl+click, touch long-press), so the
 * row's select action is suppressed while the menu is open.
 */
export function AccountContextMenuTrigger({ accountId, onSelect, render }: AccountContextMenuTriggerProps) {
  const { t } = useTranslation("sidebar");
  const isMenuOpenRef = useRef(false);

  const handleClick = (event: ReactMouseEvent<HTMLElement>) => {
    if (isMenuOpenRef.current || event.ctrlKey) {
      return;
    }

    onSelect?.();
  };

  return (
    <ContextMenu.Root
      onOpenChange={(open) => {
        isMenuOpenRef.current = open;
      }}
    >
      <ContextMenu.Trigger render={render} onClick={handleClick} />
      <AccountContextMenuContent
        settingsLabel={t("account_settings")}
        onOpenSettings={() => useUiStore.getState().openSettingsAccount(accountId)}
        subscriptionsLabel={t("open_subscriptions_index")}
        onOpenSubscriptions={() => useUiStore.getState().openSubscriptionsIndex(undefined, undefined, accountId)}
      />
    </ContextMenu.Root>
  );
}
