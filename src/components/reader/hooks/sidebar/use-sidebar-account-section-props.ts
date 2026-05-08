import { createElement } from "react";
import { AccountContextMenuContent } from "../../account-context-menu";
import type { SidebarAccountSectionProps, SidebarAccountSectionPropsParams } from "../../sidebar.types";

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
      });
  }

  return props;
}
