import type { QueryClient } from "@tanstack/react-query";
import type { AccountDto } from "@/api/tauri-commands";

export function updateCachedAccount(queryClient: QueryClient, updated: AccountDto) {
  queryClient.setQueryData<AccountDto[]>(["accounts"], (previous) =>
    previous?.map((item) => (item.id === updated.id ? updated : item)),
  );
}

export function upsertCachedAccount(queryClient: QueryClient, account: AccountDto) {
  queryClient.setQueryData<AccountDto[]>(["accounts"], (previous) => {
    if (!previous || previous.length === 0) {
      return [account];
    }

    const exists = previous.some((item) => item.id === account.id);
    if (exists) {
      return previous.map((item) => (item.id === account.id ? account : item));
    }

    return [...previous, account];
  });
}
