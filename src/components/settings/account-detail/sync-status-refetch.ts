type RefetchAccountSyncStatus = () => Promise<unknown>;

export function refetchAccountSyncStatusWithErrorSurface(refetch: RefetchAccountSyncStatus) {
  void refetch().catch((error: unknown) => {
    console.error("Failed to refetch account sync status.", error);
  });
}
