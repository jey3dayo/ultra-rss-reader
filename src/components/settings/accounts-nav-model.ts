import { isValidRequiredHttpServerUrl } from "@/lib/account/server-url";

export type AccountNavItem = {
  id: string;
  name: string;
  kind: string;
  username?: string | null;
  serverUrl?: string | null;
  isActive: boolean;
};

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

  if (!isValidRequiredHttpServerUrl(normalized)) {
    return null;
  }

  return new URL(normalized).host || null;
}

export function resolveAccountDescription(account: AccountNavItem, hasMultipleAccounts: boolean): string | null {
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
