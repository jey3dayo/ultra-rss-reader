import type { AccountDetailAccount } from "@/components/settings/account-detail/types";

export function isFreshRssAccount(account: AccountDetailAccount): boolean {
  return account.kind === "FreshRss";
}

export function isLocalAccount(account: AccountDetailAccount): boolean {
  return account.kind === "Local";
}
