import { useEffect } from "react";
import { useAccounts } from "../../hooks/use-accounts";
import { useUiStore } from "../../stores/ui-store";
import { AccountHeader } from "./AccountHeader";
import { FilterBar } from "./FilterBar";
import { SubscriptionTree } from "./SubscriptionTree";
import { UnreadCounter } from "./UnreadCounter";

export function SidebarPane() {
  const { data: accounts } = useAccounts();
  const { selectedAccountId, selectAccount } = useUiStore();

  // Auto-select first account if none selected
  useEffect(() => {
    if (!selectedAccountId && accounts && accounts.length > 0) {
      selectAccount(accounts[0].id);
    }
  }, [selectedAccountId, accounts, selectAccount]);

  return (
    <div
      style={{
        background: "var(--bg-sidebar)",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        borderRight: "1px solid var(--border-divider)",
        overflow: "hidden",
      }}
    >
      <AccountHeader />
      <UnreadCounter />
      <div style={{ flex: 1, overflow: "auto", padding: "0 var(--space-sm)" }}>
        <SubscriptionTree />
      </div>
      <FilterBar />
    </div>
  );
}
