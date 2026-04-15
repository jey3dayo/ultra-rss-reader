import { Plus, Rss } from "lucide-react";
import { NavRowButton } from "@/components/shared/nav-row-button";
import { cn } from "@/lib/utils";
import { SERVICE_CATEGORIES } from "./add-account-services";
import type { AccountsNavViewProps } from "./settings-nav.types";

export type { AccountNavItem, AccountsNavViewProps } from "./settings-nav.types";

const ACCOUNT_ICON_BG: Record<string, string> = Object.fromEntries(
  SERVICE_CATEGORIES.flatMap((cat) => cat.services.map((s) => [s.kind, s.iconBg])),
);

export function AccountsNavView({
  accounts,
  addAccountLabel,
  isAddAccountActive,
  onSelectAccount,
  onAddAccount,
}: AccountsNavViewProps) {
  return (
    <div className="space-y-1">
      {accounts.map((account) => (
        <NavRowButton
          key={account.id}
          tone="sidebar"
          selected={account.isActive}
          aria-pressed={account.isActive}
          onClick={() => onSelectAccount(account.id)}
          className={cn(
            "items-center rounded-lg px-3 py-2 text-sm",
            account.isActive && "bg-sidebar-accent/82 shadow-none",
          )}
          leading={
            <span
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full",
                ACCOUNT_ICON_BG[account.kind] ?? "bg-muted",
              )}
            >
              <Rss className="h-4 w-4 text-white" />
            </span>
          }
          title={account.name}
          description={
            <div className={account.isActive ? "text-sidebar-accent-foreground/72" : "text-sidebar-foreground/62"}>
              {account.kind}
            </div>
          }
        />
      ))}
      <NavRowButton
        tone="sidebar"
        selected={isAddAccountActive}
        aria-pressed={isAddAccountActive}
        onClick={onAddAccount}
        className={cn(
          "items-center rounded-lg px-3 py-2 text-sm",
          isAddAccountActive && "bg-sidebar-accent/82 shadow-none",
        )}
        leading={
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
            <Plus className="h-4 w-4" />
          </span>
        }
        title={addAccountLabel}
      />
    </div>
  );
}
