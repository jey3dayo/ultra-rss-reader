type SelectableAccountLike = {
  id: string;
  disabled?: boolean;
  enabled?: boolean;
};

function isSelectableAccount(account: SelectableAccountLike): boolean {
  return account.disabled !== true && account.enabled !== false;
}

export function getPreferredAccountId<T extends SelectableAccountLike>(
  accounts: readonly T[],
  savedAccountId: string | null | undefined,
): string | null {
  const selectableAccounts = accounts.filter(isSelectableAccount);
  if (selectableAccounts.length === 0) {
    return null;
  }

  const normalizedSavedAccountId = savedAccountId?.trim();
  if (normalizedSavedAccountId && selectableAccounts.some((account) => account.id === normalizedSavedAccountId)) {
    return normalizedSavedAccountId;
  }

  return selectableAccounts[0].id;
}

type RestoredAccountSelectionParams<T extends SelectableAccountLike> = {
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

function hasAccountId<T extends SelectableAccountLike>(
  accounts: readonly T[],
  accountId: string | null,
): accountId is string {
  return accountId !== null && accounts.some((account) => account.id === accountId && isSelectableAccount(account));
}

export function resolveRestoredAccountSelection<T extends SelectableAccountLike>({
  accounts,
  selectedAccountId,
  savedAccountId,
}: RestoredAccountSelectionParams<T>): RestoredAccountSelection {
  if (!accounts.some(isSelectableAccount)) {
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
