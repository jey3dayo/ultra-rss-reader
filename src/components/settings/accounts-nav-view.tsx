import { Plus, Rss } from "lucide-react";
import type { ReactNode } from "react";
import { NavRowButton } from "@/design-system";
import { cn } from "@/lib/utils";
import { type AccountNavItem, resolveAccountDescription } from "./accounts-nav-model";
import { SERVICE_CATEGORIES } from "./add-account/services";

type AccountNavSelectHandler = (accountId: string) => void;

export type { AccountNavItem } from "./accounts-nav-model";

export type AccountsNavViewProps = {
  accounts: AccountNavItem[];
  addAccountLabel: string;
  isAddAccountActive: boolean;
  onSelectAccount: AccountNavSelectHandler;
  onAddAccount: () => void;
  disabled?: boolean;
};

const ACCOUNT_ICON_BG: Record<string, string> = Object.fromEntries(
  SERVICE_CATEGORIES.flatMap((cat) => cat.services.map((s) => [s.kind.toLowerCase(), s.iconBg])),
);
const ACCOUNT_SELECTED_CLASS_NAME =
  "bg-[image:var(--sidebar-selection-gradient)] text-[var(--sidebar-selection-foreground)] shadow-none before:absolute before:inset-y-1.5 before:left-0 before:w-0.5 before:rounded-full before:bg-border-strong/70 before:opacity-70 focus-visible:bg-[image:var(--sidebar-selection-gradient)]";
const DEFAULT_ACCOUNT_ICON = (
  <span className="flex size-7 items-center justify-center rounded-full bg-surface-1/72">
    <Rss className="size-[15px] text-white" />
  </span>
);
const ADD_ACCOUNT_ICON = (
  <span className="flex size-7 items-center justify-center rounded-full bg-surface-1/72">
    <Plus className="size-[15px]" />
  </span>
);
const ACCOUNT_ICON_BY_KIND: Record<string, ReactNode> = Object.fromEntries(
  Object.entries(ACCOUNT_ICON_BG).map(([kind, className]) => [
    kind,
    <span key={kind} className={cn("flex size-7 items-center justify-center rounded-full", className)}>
      <Rss className="size-[15px] text-white" />
    </span>,
  ]),
);

export function AccountsNavView({
  accounts,
  addAccountLabel,
  isAddAccountActive,
  onSelectAccount,
  onAddAccount,
  disabled = false,
}: AccountsNavViewProps) {
  const hasMultipleAccounts = accounts.length > 1;

  return (
    <div className="flex flex-wrap gap-2 overflow-visible sm:block sm:space-y-1">
      {accounts.map((account) => {
        const kindKey = account.kind.toLowerCase();
        const description = resolveAccountDescription(account, hasMultipleAccounts);

        return (
          <NavRowButton
            key={account.id}
            tone="sidebar"
            selected={account.isActive}
            disabled={disabled}
            onClick={() => onSelectAccount(account.id)}
            className={cn(
              "relative w-auto max-w-full shrink-0 overflow-hidden rounded-md px-3 py-2 text-[13px] leading-[1.3] focus-visible:ring-2 focus-visible:ring-border-strong/45 sm:w-full",
              account.isActive && ACCOUNT_SELECTED_CLASS_NAME,
            )}
            leading={ACCOUNT_ICON_BY_KIND[kindKey] ?? DEFAULT_ACCOUNT_ICON}
            title={account.name}
            description={description ?? undefined}
            descriptionClassName={
              account.isActive ? "text-[var(--sidebar-selection-muted)]" : "text-sidebar-foreground/54"
            }
          />
        );
      })}
      <NavRowButton
        tone="sidebar"
        selected={isAddAccountActive}
        disabled={disabled}
        onClick={onAddAccount}
        className={cn(
          "relative w-auto max-w-full shrink-0 items-center overflow-hidden rounded-md px-3 py-2 text-[13px] leading-[1.3] focus-visible:ring-2 focus-visible:ring-border-strong/45 sm:w-full",
          isAddAccountActive && ACCOUNT_SELECTED_CLASS_NAME,
        )}
        leading={ADD_ACCOUNT_ICON}
        title={addAccountLabel}
      />
    </div>
  );
}
