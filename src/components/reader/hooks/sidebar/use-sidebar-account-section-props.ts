import { createElement } from "react";
import { useUiStore } from "@/stores/ui-store";
import { AccountContextMenuContent } from "../../account-context-menu";
import type { SidebarAccountSectionPropsParams } from "../../sidebar.types";
import type { SidebarAccountSectionProps } from "../../sidebar-account-section";

export function useSidebarAccountSectionProps({
  t,
  selectedAccountName,
  lastSyncedLabel,
  accounts,
  accountStatusLabels,
  selectedAccountId,
  isAccountListOpen,
  accountMenuId,
  accountDropdownRef,
  accountTriggerRef,
  accountItemRefs,
  toggleAccountList,
  handleSelectAccount,
  closeAccountList,
  handleOpenAccountSettings,
}: SidebarAccountSectionPropsParams): SidebarAccountSectionProps {
  const props: SidebarAccountSectionProps = {
    containerRef: accountDropdownRef,
    title: selectedAccountName ?? t("app_name"),
    lastSyncedLabel,
    accounts,
    accountStatusLabels,
    selectedAccountId,
    isExpanded: isAccountListOpen,
    menuId: accountMenuId,
    menuLabel: t("accounts"),
    triggerRef: accountTriggerRef,
    itemRefs: accountItemRefs,
    onToggle: toggleAccountList,
    onSelectAccount: handleSelectAccount,
    onClose: closeAccountList,
  };

  if (selectedAccountId) {
    props.renderContextMenu = () =>
      createElement(AccountContextMenuContent, {
        settingsLabel: t("account_settings"),
        onOpenSettings: handleOpenAccountSettings,
        subscriptionsLabel: t("open_subscriptions_index"),
        onOpenSubscriptions: () =>
          useUiStore.getState().openSubscriptionsIndex(undefined, undefined, selectedAccountId),
      });
  }

  return props;
}
