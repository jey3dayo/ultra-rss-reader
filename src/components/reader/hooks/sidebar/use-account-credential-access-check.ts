import { Result } from "@praha/byethrow";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { testAccountConnection } from "@/api/tauri-commands";
import { accountSyncStatusQueryKey } from "@/hooks/use-account-sync-status";
import { invalidateQueryKeysLogOnly, queryKeys } from "@/lib/query/query-invalidation";
import { redactProviderRuntimeDiagnosticText } from "@/lib/runtime/diagnostics";
import { getErrorMessage } from "@/lib/ui/errors";
import { localizeUserVisibleAppErrorMessage } from "@/lib/ui/localize-app-error-message";
import { useUiStore } from "@/stores/ui-store";

type CheckTarget = { id: string; name: string };

async function requestConnectionCheck(accountId: string): Promise<string | null> {
  try {
    const result = await testAccountConnection(accountId);
    return Result.isFailure(result) ? Result.unwrapError(result).message : null;
  } catch (error) {
    return getErrorMessage(error);
  }
}

export function useAccountCredentialAccessCheck() {
  const { t } = useTranslation("sidebar");
  const queryClient = useQueryClient();
  const inFlightAccountIdsRef = useRef(new Set<string>());
  const [checkingAccountIds, setCheckingAccountIds] = useState<ReadonlySet<string>>(() => new Set());

  const checkConnection = useCallback(
    async (account: CheckTarget) => {
      if (inFlightAccountIdsRef.current.has(account.id)) {
        return;
      }
      inFlightAccountIdsRef.current.add(account.id);
      setCheckingAccountIds((current) => new Set(current).add(account.id));

      try {
        const failureMessage = await requestConnectionCheck(account.id);
        if (failureMessage !== null) {
          useUiStore.getState().showToast({
            message: t("account_connection_check_failed", {
              account: account.name,
              message: redactProviderRuntimeDiagnosticText(localizeUserVisibleAppErrorMessage(failureMessage)),
            }),
            severity: "error",
          });
          useUiStore.getState().openSettingsAccount(account.id);
        }
        await invalidateQueryKeysLogOnly(
          queryClient,
          failureMessage === null
            ? [accountSyncStatusQueryKey(account.id), queryKeys.accounts.root]
            : [queryKeys.accounts.root],
        );
      } finally {
        inFlightAccountIdsRef.current.delete(account.id);
        setCheckingAccountIds((current) => {
          const next = new Set(current);
          next.delete(account.id);
          return next;
        });
      }
    },
    [queryClient, t],
  );

  const isChecking = useCallback((accountId: string) => checkingAccountIds.has(accountId), [checkingAccountIds]);

  return { checkConnection, isChecking };
}
