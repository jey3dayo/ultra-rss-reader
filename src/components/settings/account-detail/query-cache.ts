import type { QueryClient } from "@tanstack/react-query";
import type { AccountDto } from "@/api/tauri-commands";
import { queryKeys } from "@/lib/query/query-invalidation";

type AccountDetailCachePatchOwner = "optimistic-update" | "server-refetch";

type PatchCachedAccountOptions = {
  owner: AccountDetailCachePatchOwner;
};

export function updateCachedAccount(queryClient: QueryClient, updated: AccountDto) {
  patchCachedAccount(queryClient, updated, { owner: "server-refetch" });
}

export function upsertCachedAccount(queryClient: QueryClient, account: AccountDto) {
  patchCachedAccount(queryClient, account, { owner: "optimistic-update" });
}

export function removeCachedAccount(queryClient: QueryClient, accountId: string) {
  queryClient.setQueryData<AccountDto[]>(queryKeys.accounts.root, (previous) =>
    previous?.filter((item) => item.id !== accountId),
  );
}

export function patchCachedAccount(queryClient: QueryClient, account: AccountDto, options: PatchCachedAccountOptions) {
  queryClient.setQueryData<AccountDto[]>(queryKeys.accounts.root, (previous) => {
    if (!previous) {
      return options.owner === "optimistic-update" ? [account] : undefined;
    }

    const patched = previous.map((item) => (item.id === account.id ? account : item));
    if (patched.some((item) => item.id === account.id)) {
      return patched;
    }

    if (options.owner === "server-refetch") {
      return previous;
    }

    return [...previous, account];
  });
}
