import { AccountHeader } from "./AccountHeader";
import { FilterBar } from "./FilterBar";
import { SubscriptionTree } from "./SubscriptionTree";
import { UnreadCounter } from "./UnreadCounter";

export function SidebarPane() {
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
