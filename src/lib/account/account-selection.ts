export function getPreferredAccountId<T extends { id: string }>(
  accounts: readonly T[],
  savedAccountId: string | null | undefined,
): string | null {
  if (accounts.length === 0) {
    return null;
  }

  const normalizedSavedAccountId = savedAccountId?.trim();
  if (normalizedSavedAccountId && accounts.some((account) => account.id === normalizedSavedAccountId)) {
    return normalizedSavedAccountId;
  }

  return accounts[0].id;
}

type RestoredAccountSelectionParams<T extends { id: string }> = {
  accounts: readonly T[];
  selectedAccountId: string | null | undefined;
  savedAccountId: string | null | undefined;
};

type RestoredAccountSelection = {
  accountId: string | null;
  preferenceAccountId: string;
};

function normalizeAccountId(value: string | null | undefined): string | null {
  const normalizedValue = value?.trim();
  return normalizedValue && normalizedValue.length > 0 ? normalizedValue : null;
}

function hasAccountId<T extends { id: string }>(accounts: readonly T[], accountId: string | null): accountId is string {
  return accountId !== null && accounts.some((account) => account.id === accountId);
}

export function resolveRestoredAccountSelection<T extends { id: string }>({
  accounts,
  selectedAccountId,
  savedAccountId,
}: RestoredAccountSelectionParams<T>): RestoredAccountSelection {
  if (accounts.length === 0) {
    return {
      accountId: null,
      preferenceAccountId: "",
    };
  }

  const normalizedSelectedAccountId = normalizeAccountId(selectedAccountId);
  if (hasAccountId(accounts, normalizedSelectedAccountId)) {
    return {
      accountId: normalizedSelectedAccountId,
      preferenceAccountId: normalizedSelectedAccountId,
    };
  }

  const preferredAccountId = getPreferredAccountId(accounts, savedAccountId);
  if (preferredAccountId === null) {
    return {
      accountId: null,
      preferenceAccountId: "",
    };
  }

  return {
    accountId: preferredAccountId,
    preferenceAccountId: preferredAccountId,
  };
}
