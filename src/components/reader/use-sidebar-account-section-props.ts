import type { SidebarAccountSectionProps, SidebarAccountSectionPropsParams } from "./sidebar.types";

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
}: SidebarAccountSectionPropsParams): SidebarAccountSectionProps {
  return {
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
}
