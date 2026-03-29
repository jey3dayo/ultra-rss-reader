import { Plus, Rss } from "lucide-react";
import { cn } from "@/lib/utils";

export type AccountNavItem = {
  id: string;
  name: string;
  kind: string;
  isActive: boolean;
};

type AccountsNavViewProps = {
  accounts: AccountNavItem[];
  addAccountLabel: string;
  isAddAccountActive: boolean;
  onSelectAccount: (accountId: string) => void;
  onAddAccount: () => void;
};

export function AccountsNavView({
  accounts,
  addAccountLabel,
  isAddAccountActive,
  onSelectAccount,
  onAddAccount,
}: AccountsNavViewProps) {
  return (
    <>
      {accounts.map((account) => (
        <button
          type="button"
          key={account.id}
          onClick={() => onSelectAccount(account.id)}
          className={cn(
            "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
            account.isActive ? "bg-sidebar-accent" : "hover:bg-sidebar-accent/50",
          )}
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Rss className="h-4 w-4" />
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
          "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground",
          isAddAccountActive ? "bg-sidebar-accent" : "hover:bg-sidebar-accent/50",
        )}
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
          <Plus className="h-4 w-4" />
        </span>
        {addAccountLabel}
      </button>
    </>
  );
}
