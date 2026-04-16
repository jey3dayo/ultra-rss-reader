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
  inoreader: "Inoreader",
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
    <div className="space-y-1">
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
              "relative items-center overflow-hidden rounded-lg px-3 py-2 text-sm hover:bg-sidebar-accent/58",
              account.isActive &&
                "border border-border-strong bg-[var(--bg-selected)] text-sidebar-accent-foreground shadow-none before:absolute before:inset-y-1.5 before:left-0 before:w-0.5 before:rounded-full before:bg-border-strong",
            )}
            leading={
              <span
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full",
                  ACCOUNT_ICON_BG[kindKey] ?? "bg-muted",
                )}
              >
                <Rss className="h-4 w-4 text-white" />
              </span>
            }
            title={account.name}
            description={
              kindDescription ? (
                <div className={account.isActive ? "text-sidebar-accent-foreground/72" : "text-sidebar-foreground/62"}>
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
          "relative items-center overflow-hidden rounded-lg px-3 py-2 text-sm hover:bg-sidebar-accent/58",
          isAddAccountActive &&
            "border border-border-strong bg-[var(--bg-selected)] text-sidebar-accent-foreground shadow-none before:absolute before:inset-y-1.5 before:left-0 before:w-0.5 before:rounded-full before:bg-border-strong",
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
