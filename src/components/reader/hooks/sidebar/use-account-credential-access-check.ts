import { Result } from "@praha/byethrow";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { CredentialFailure } from "@/api/schemas";
import { testAccountConnection } from "@/api/tauri-commands";
import { accountSyncStatusQueryKey } from "@/hooks/use-account-sync-status";
import { getCredentialFailure } from "@/lib/account/credential-failure";
import { invalidateQueryKeysLogOnly, queryKeys } from "@/lib/query/query-invalidation";
import { redactProviderRuntimeDiagnosticText } from "@/lib/runtime/diagnostics";
import { getErrorMessage } from "@/lib/ui/errors";
import { localizeUserVisibleAppErrorMessage } from "@/lib/ui/localize-app-error-message";
import { useUiStore } from "@/stores/ui-store";

type CheckTarget = { id: string; name: string };

type ConnectionCheckFailure = { message: string; cause: CredentialFailure["cause"] | null };

async function requestConnectionCheck(accountId: string): Promise<ConnectionCheckFailure | null> {
  try {
    const result = await testAccountConnection(accountId);
    if (Result.isSuccess(result)) {
      return null;
    }
    const error = Result.unwrapError(result);
    return { message: error.message, cause: getCredentialFailure(error)?.cause ?? null };
  } catch (error) {
    return { message: getErrorMessage(error), cause: null };
  }
}

function resolveCredentialFailureReasonKey(cause: CredentialFailure["cause"]) {
  switch (cause) {
    case "canceled":
    case "not_allowed":
      return cause;
    default:
      return "other";
  }
}

export function useAccountCredentialAccessCheck() {
  const { t } = useTranslation("sidebar");
  const queryClient = useQueryClient();
  const inFlightAccountIdsRef = useRef(new Set<string>());
  const [checkingAccountIds, setCheckingAccountIds] = useState<ReadonlySet<string>>(() => new Set());

  const showFailure = useCallback(
    (account: CheckTarget, failure: ConnectionCheckFailure) => {
      const message =
        failure.cause === null
          ? t("account_connection_check_failed", {
              account: account.name,
              message: redactProviderRuntimeDiagnosticText(localizeUserVisibleAppErrorMessage(failure.message)),
            })
          : t("account_connection_check_failed_reason", {
              account: account.name,
              reason: t(`account_credential_failure.${resolveCredentialFailureReasonKey(failure.cause)}`),
            });
      useUiStore.getState().showToast({ message, severity: "error" });
      useUiStore.getState().openSettingsAccount(account.id);
    },
    [t],
  );

  const checkConnection = useCallback(
    async (account: CheckTarget) => {
      if (inFlightAccountIdsRef.current.has(account.id)) {
        return;
      }
      inFlightAccountIdsRef.current.add(account.id);
      setCheckingAccountIds((current) => new Set(current).add(account.id));

      try {
        const failure = await requestConnectionCheck(account.id);
        if (failure === null) {
          useUiStore.getState().showToast(t("account_connection_check_succeeded", { account: account.name }));
        } else {
          showFailure(account, failure);
        }
        await invalidateQueryKeysLogOnly(
          queryClient,
          failure === null
            ? [accountSyncStatusQueryKey(account.id), queryKeys.accounts.root]
            : [queryKeys.accounts.root],
        );
      } catch (error) {
        console.error("Failed to finish the credential access check:", error);
      } finally {
        inFlightAccountIdsRef.current.delete(account.id);
        setCheckingAccountIds((current) => {
          const next = new Set(current);
          next.delete(account.id);
          return next;
        });
      }
    },
    [queryClient, showFailure, t],
  );

  const isChecking = useCallback((accountId: string) => checkingAccountIds.has(accountId), [checkingAccountIds]);

  return { checkConnection, isChecking };
}
