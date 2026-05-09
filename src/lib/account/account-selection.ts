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
