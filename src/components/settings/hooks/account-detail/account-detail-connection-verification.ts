import { Result } from "@praha/byethrow";
import type { QueryClient } from "@tanstack/react-query";
import type { Dispatch } from "react";
import type { AppError } from "@/api/schemas";
import { getAccountCloudflareAccess, testAccountConnection } from "@/api/tauri-commands";
import { accountSyncStatusQueryKey } from "@/hooks/use-account-sync-status";
import { getCredentialFailure } from "@/lib/account/credential-failure";
import { invalidateQueryKeysLogOnly, queryKeys } from "@/lib/query/query-invalidation";
import { getErrorMessage } from "@/lib/ui/errors";
import { updateCachedAccount } from "../../account-detail/query-cache";
import type { createAccountDetailErrorToast } from "../../account-detail/toast";
import {
  type AccountDetailCredentialsEditorAction,
  type AccountDetailCredentialsEditorParams,
  mergeVerifiedAccount,
} from "./account-detail-credentials-editor-state";

export async function runAccountConnectionVerification({
  account,
  queryClient,
  dispatch,
  showConnectionError,
  showSavedConnectionError,
  isStaleVerificationRequest,
  requestAccountId,
  requestDraftRevision,
  verifiedAccountBase,
}: {
  account: AccountDetailCredentialsEditorParams["account"];
  queryClient: QueryClient;
  dispatch: Dispatch<AccountDetailCredentialsEditorAction>;
  showConnectionError: ReturnType<typeof createAccountDetailErrorToast>;
  showSavedConnectionError: ReturnType<typeof createAccountDetailErrorToast>;
  isStaleVerificationRequest: (requestAccountId: string, requestDraftRevision: number) => boolean;
  requestAccountId: string;
  requestDraftRevision: number;
  verifiedAccountBase?: AccountDetailCredentialsEditorParams["account"];
}): Promise<boolean> {
  const saved = verifiedAccountBase !== undefined;
  const reportConnectionFailure = (error: AppError): void => {
    const failure = getCredentialFailure(error);
    if (failure === null) {
      (saved ? showSavedConnectionError : showConnectionError)(error);
      return;
    }
    dispatch({
      type: "set-credential-failure",
      value: { ...failure, operation: saved ? "check_after_save" : "check" },
    });
  };

  dispatch({ type: "set-credential-failure", value: null });
  let result: Awaited<ReturnType<typeof testAccountConnection>>;
  try {
    result = await testAccountConnection(requestAccountId);
  } catch (error) {
    if (isStaleVerificationRequest(requestAccountId, requestDraftRevision)) {
      return false;
    }
    reportConnectionFailure({ type: "UserVisible", message: getErrorMessage(error) });
    await queryClient.invalidateQueries({ queryKey: queryKeys.accounts.root });
    return false;
  }

  if (isStaleVerificationRequest(requestAccountId, requestDraftRevision)) {
    return false;
  }
  if (Result.isFailure(result)) {
    reportConnectionFailure(Result.unwrapError(result));
    await queryClient.invalidateQueries({ queryKey: queryKeys.accounts.root });
    return false;
  }

  const metadata = await getAccountCloudflareAccess(requestAccountId).catch(() => null);
  const loadedMetadata = metadata && Result.isSuccess(metadata) ? Result.unwrap(metadata) : null;
  if (loadedMetadata?.status === "loaded" && !isStaleVerificationRequest(requestAccountId, requestDraftRevision)) {
    dispatch({
      type: "cloudflare-access-loaded",
      clientId: loadedMetadata.client_id,
      serverUrl: (verifiedAccountBase ?? account).server_url ?? "",
    });
  }
  if (isStaleVerificationRequest(requestAccountId, requestDraftRevision)) {
    return false;
  }
  const verifiedAccount = Result.unwrap(result);
  updateCachedAccount(queryClient, mergeVerifiedAccount(verifiedAccount, verifiedAccountBase));
  await invalidateQueryKeysLogOnly(queryClient, [accountSyncStatusQueryKey(requestAccountId)]);
  return true;
}
