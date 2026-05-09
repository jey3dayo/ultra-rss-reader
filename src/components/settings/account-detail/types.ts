import type { QueryClient } from "@tanstack/react-query";
import type { TFunction } from "i18next";
import type { AccountDto } from "@/api/tauri-commands";

export type AccountDetailAccount = AccountDto;

export type AccountDetailEditorContext = {
  account: AccountDetailAccount;
  queryClient: QueryClient;
  t: TFunction<"settings">;
};
