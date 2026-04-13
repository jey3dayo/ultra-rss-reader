import { Plus, Rss } from "lucide-react";
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
        <button
          type="button"
          key={account.id}
          onClick={() => onSelectAccount(account.id)}
          className={cn(
            "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors",
            account.isActive ? "bg-sidebar-accent" : "hover:bg-sidebar-accent/50",
          )}
        >
          <span
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-full",
              ACCOUNT_ICON_BG[account.kind] ?? "bg-muted",
            )}
          >
            <Rss className="h-4 w-4 text-white" />
          </span>
          <div className="flex flex-col items-start">
            <span className="font-medium">{account.name}</span>
            <span className="text-xs text-muted-foreground">{account.kind}</span>
          </div>
        </button>
      ))}
      <button
        type="button"
        onClick={onAddAccount}
        className={cn(
          "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm text-muted-foreground",
          isAddAccountActive ? "bg-sidebar-accent" : "hover:bg-sidebar-accent/50",
        )}
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
          <Plus className="h-4 w-4" />
        </span>
        {addAccountLabel}
      </button>
    </div>
  );
}
