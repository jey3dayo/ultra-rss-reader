import { Plus, Rss } from "lucide-react";
import { NavRowButton } from "@/components/shared/nav-row-button";
import { cn } from "@/lib/utils";
import { SERVICE_CATEGORIES } from "./add-account-services";
import type { AccountsNavViewProps } from "./settings-nav.types";

export type { AccountNavItem, AccountsNavViewProps } from "./settings-nav.types";

const ACCOUNT_KIND_LABELS: Record<string, string> = {
  local: "Local",
  freshrss: "FreshRSS",
  fever: "Fever",
  feedly: "Feedly",
};

const ACCOUNT_ICON_BG: Record<string, string> = Object.fromEntries(
  SERVICE_CATEGORIES.flatMap((cat) => cat.services.map((s) => [s.kind.toLowerCase(), s.iconBg])),
);

function getAccountKindLabel(kind: string): string {
  return ACCOUNT_KIND_LABELS[kind.toLowerCase()] ?? "Account";
}

function getAccountKindDescription(accountName: string, kind: string): string | null {
  const kindLabel = getAccountKindLabel(kind);

  return accountName.trim().toLowerCase() === kindLabel.toLowerCase() ? null : kindLabel;
}

export function AccountsNavView({
  accounts,
  addAccountLabel,
  isAddAccountActive,
  onSelectAccount,
  onAddAccount,
}: AccountsNavViewProps) {
  return (
    <div className="flex gap-2 overflow-x-auto sm:block sm:space-y-1 sm:overflow-visible">
      {accounts.map((account) => {
        const kindKey = account.kind.toLowerCase();
        const kindDescription = getAccountKindDescription(account.name, account.kind);

        return (
          <NavRowButton
            key={account.id}
            tone="sidebar"
            selected={account.isActive}
            aria-pressed={account.isActive}
            onClick={() => onSelectAccount(account.id)}
            className={cn(
              "relative shrink-0 items-center overflow-hidden rounded-md px-3 py-1.5 text-[13px] leading-[1.25] sm:w-full",
              account.isActive &&
                "border border-border-strong bg-[var(--bg-selected)] text-sidebar-accent-foreground shadow-none before:absolute before:inset-y-1.5 before:left-0 before:w-0.5 before:rounded-full before:bg-border-strong",
            )}
            leading={
              <span
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full",
                  ACCOUNT_ICON_BG[kindKey] ?? "bg-surface-1/72",
                )}
              >
                <Rss className="h-[15px] w-[15px] text-white" />
              </span>
            }
            title={account.name}
            description={
              kindDescription ? (
                <div
                  className={
                    account.isActive ? "text-[color:var(--settings-shell-section-label)]" : "text-sidebar-foreground/38"
                  }
                >
                  {kindDescription}
                </div>
              ) : undefined
            }
          />
        );
      })}
      <NavRowButton
        tone="sidebar"
        selected={isAddAccountActive}
        aria-pressed={isAddAccountActive}
        onClick={onAddAccount}
        className={cn(
          "relative shrink-0 items-center overflow-hidden rounded-md px-3 py-1.5 text-[13px] leading-[1.25] sm:w-full",
          isAddAccountActive &&
            "border border-border-strong bg-[var(--bg-selected)] text-sidebar-accent-foreground shadow-none before:absolute before:inset-y-1.5 before:left-0 before:w-0.5 before:rounded-full before:bg-border-strong",
        )}
        leading={
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-1/72">
            <Plus className="h-[15px] w-[15px]" />
          </span>
        }
        title={addAccountLabel}
      />
    </div>
  );
}
