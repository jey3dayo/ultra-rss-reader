import type { TFunction } from "i18next";
import { useUiStore } from "@/stores/ui-store";

type AccountDetailError = {
  message: string;
};

export function createAccountDetailErrorToast(
  t: TFunction<"settings">,
  key: `account.${string}`,
) {
  return (error: AccountDetailError) => {
    useUiStore.getState().showToast(t(key, { message: error.message }));
  };
}
