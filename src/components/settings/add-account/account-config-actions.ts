import { Result } from "@praha/byethrow";
import { type AccountDto, type AppError, addAccount } from "@/api/tauri-commands";
import type { AddAccountPayload } from "@/lib/account/add-account-form";

type AddAccountCommandHandlers<T> = {
  onSuccess: (account: AccountDto) => T;
  onFailure: (error: AppError) => T;
};

export async function matchAddAccountCommand<T>(
  payload: AddAccountPayload,
  handlers: AddAccountCommandHandlers<T>,
): Promise<T> {
  const result = await addAccount(payload.kind, payload.name, payload.serverUrl, payload.username, payload.password);
  return Result.isSuccess(result)
    ? handlers.onSuccess(Result.unwrap(result))
    : handlers.onFailure(Result.unwrapError(result));
}
