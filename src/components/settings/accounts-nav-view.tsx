import { Plus, Rss } from "lucide-react";
import { NavRowButton } from "@/components/shared/nav-row-button";
import { cn } from "@/lib/utils";
import { SERVICE_CATEGORIES } from "./add-account-services";
import type { AccountsNavViewProps } from "./settings-nav.types";

export type { AccountNavItem, AccountsNavViewProps } from "./settings-nav.types";

const ACCOUNT_ICON_BG: Record<string, string> = Object.fromEntries(
  SERVICE_CATEGORIES.flatMap((cat) => cat.services.map((s) => [s.kind.toLowerCase(), s.iconBg])),
);
const ACCOUNT_SELECTED_CLASS_NAME =
  "bg-[image:var(--sidebar-selection-gradient)] text-[var(--sidebar-selection-foreground)] shadow-none before:absolute before:inset-y-1.5 before:left-0 before:w-0.5 before:rounded-full before:bg-border-strong/70 before:opacity-70 focus-visible:bg-[image:var(--sidebar-selection-gradient)]";

function normalizeDetail(value?: string | null): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function normalizeComparable(value: string): string {
  return value.trim().toLowerCase();
}

function getServerHostLabel(serverUrl?: string | null): string | null {
  const normalized = normalizeDetail(serverUrl);
  if (!normalized) {
    return null;
  }

  try {
    return new URL(normalized).host || normalized;
  } catch {
    return normalized;
  }
}

export function resolveAccountDescription(
  account: AccountsNavViewProps["accounts"][number],
  hasMultipleAccounts: boolean,
): string | null {
  if (!hasMultipleAccounts) {
    return null;
  }

  const title = normalizeComparable(account.name);
  const candidates = [normalizeDetail(account.username), getServerHostLabel(account.serverUrl)];

  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }
    if (normalizeComparable(candidate) === title) {
      continue;
    }
    return candidate;
  }

  return null;
}

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
            aria-pressed={account.isActive}
            disabled={disabled}
            onClick={() => onSelectAccount(account.id)}
            className={cn(
              "relative w-auto max-w-full shrink-0 overflow-hidden rounded-md px-3 py-2 text-[13px] leading-[1.3] focus-visible:ring-0 focus-visible:ring-transparent sm:w-full",
              account.isActive && ACCOUNT_SELECTED_CLASS_NAME,
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
              description ? (
                <div
                  className={account.isActive ? "text-[var(--sidebar-selection-muted)]" : "text-sidebar-foreground/54"}
                >
                  {description}
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
        disabled={disabled}
        onClick={onAddAccount}
        className={cn(
          "relative w-auto max-w-full shrink-0 items-center overflow-hidden rounded-md px-3 py-2 text-[13px] leading-[1.3] focus-visible:ring-0 focus-visible:ring-transparent sm:w-full",
          isAddAccountActive && ACCOUNT_SELECTED_CLASS_NAME,
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
