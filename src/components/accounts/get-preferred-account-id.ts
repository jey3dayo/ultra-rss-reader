type AccountWithId = {
  id: string;
};

export function getPreferredAccountId(
  accounts: readonly AccountWithId[],
  savedAccountId: string | null | undefined,
): string | null {
  if (accounts.length === 0) {
    return null;
  }

  if (savedAccountId && accounts.some((account) => account.id === savedAccountId)) {
    return savedAccountId;
  }

  return accounts[0].id;
}
