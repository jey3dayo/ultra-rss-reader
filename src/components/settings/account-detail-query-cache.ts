import type { QueryClient } from "@tanstack/react-query";
import type { AccountDto } from "@/api/tauri-commands";

export function updateCachedAccount(queryClient: QueryClient, updated: AccountDto) {
  queryClient.setQueryData<AccountDto[]>(["accounts"], (previous) =>
    previous?.map((item) => (item.id === updated.id ? updated : item)),
  );
}
