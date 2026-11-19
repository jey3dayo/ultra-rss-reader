import { AlertCircle, Plus } from "lucide-react";
import type { RefObject } from "react";
import { useTranslation } from "react-i18next";
import { NavRowButton } from "@/design-system";
import { useAccountSyncStatuses } from "@/hooks/use-account-sync-statuses";
import { useUiStore } from "@/stores/ui-store";
import { type AccountSwitcherProps, AccountSwitcherView } from "./account-switcher-view";

export type SidebarAccountSectionProps = AccountSwitcherProps & {
  containerRef: RefObject<HTMLDivElement | null>;
  addAccountLabel: string;
  onAddAccount: () => void;
};

export function SidebarAccountSection({
  containerRef,
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
  addAccountLabel,
  onAddAccount,
}: SidebarAccountSectionProps) {
  const { t } = useTranslation("sidebar");
  const statuses = useAccountSyncStatuses(accounts);
  return (
    <div ref={containerRef}>
      <AccountSwitcherView
        title={title}
        lastSyncedLabel={lastSyncedLabel}
        accounts={accounts}
        accountStatusLabels={accountStatusLabels}
        selectedAccountId={selectedAccountId}
        isExpanded={isExpanded}
        menuId={menuId}
        menuLabel={menuLabel}
        triggerRef={triggerRef}
        itemRefs={itemRefs}
        onToggle={onToggle}
        onSelectAccount={onSelectAccount}
        onClose={onClose}
        renderContextMenu={renderContextMenu}
      />
      {accounts
        .filter((account) => statuses[account.id]?.waiting_for_credential_access)
        .map((account) => (
          <div className="px-3 pb-2" key={account.id}>
            <NavRowButton
              tone="sidebar"
              title={t("account_connection_attention", { account: account.name })}
              description={t("open_account_settings")}
              leading={<AlertCircle aria-hidden="true" className="size-4" />}
              onClick={() => useUiStore.getState().openSettingsAccount(account.id)}
              aria-label={`${t("account_connection_attention", { account: account.name })} — ${t("open_account_settings")}`}
              className="min-h-11 items-center gap-2 text-sm"
            />
          </div>
        ))}
      <div className="px-3 pb-3">
        <NavRowButton
          tone="sidebar"
          title={addAccountLabel}
          leading={<Plus aria-hidden="true" className="size-4" />}
          onClick={() => onAddAccount()}
          className="min-h-11 items-center gap-2 text-sm"
        />
      </div>
    </div>
  );
}
