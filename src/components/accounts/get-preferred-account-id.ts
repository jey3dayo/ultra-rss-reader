export function getPreferredAccountId<T extends { id: string }>(
  accounts: readonly T[],
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
