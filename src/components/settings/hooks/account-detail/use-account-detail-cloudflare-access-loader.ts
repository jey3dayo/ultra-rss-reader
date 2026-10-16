import { Result } from "@praha/byethrow";
import { type Dispatch, type RefObject, useEffect } from "react";
import { getAccountCloudflareAccess } from "@/api/tauri-commands";
import { hasTauriRuntime } from "@/lib/window/window-chrome";
import type {
  AccountDetailCredentialsEditorAction,
  AccountDetailCredentialsEditorParams,
} from "./account-detail-credentials-editor-state";

export function useAccountDetailCloudflareAccessLoader({
  account,
  dispatch,
  cloudflareAccessRequestIdRef,
  activeAccountIdRef,
}: {
  account: AccountDetailCredentialsEditorParams["account"];
  dispatch: Dispatch<AccountDetailCredentialsEditorAction>;
  cloudflareAccessRequestIdRef: RefObject<number>;
  activeAccountIdRef: RefObject<string>;
}): void {
  useEffect(() => {
    if (account.kind.toLowerCase() !== "freshrss") {
      return;
    }
    const hasBrowserMock =
      typeof window !== "undefined" &&
      window.__DEV_BROWSER_MOCKS__ === true &&
      window.__ULTRA_RSS_BROWSER_MOCKS__ === true &&
      window.__TAURI_INTERNALS__ !== null &&
      typeof window.__TAURI_INTERNALS__ === "object" &&
      typeof Reflect.get(window.__TAURI_INTERNALS__, "invoke") === "function";
    if (!hasTauriRuntime() && !hasBrowserMock) {
      dispatch({ type: "set-cloudflare-access-status", value: "unavailable" });
      return;
    }

    const requestId = cloudflareAccessRequestIdRef.current + 1;
    cloudflareAccessRequestIdRef.current = requestId;
    let active = true;
    dispatch({ type: "set-cloudflare-access-status", value: "loading" });
    void getAccountCloudflareAccess(account.id)
      .then((result) => {
        if (
          !active ||
          cloudflareAccessRequestIdRef.current !== requestId ||
          activeAccountIdRef.current !== account.id
        ) {
          return;
        }
        if (Result.isFailure(result)) {
          dispatch({ type: "set-cloudflare-access-status", value: "error" });
          return;
        }
        const metadata = Result.unwrap(result);
        if (metadata.status === "authorization_required") {
          dispatch({ type: "set-cloudflare-access-status", value: "authorization_required" });
          return;
        }
        dispatch({
          type: "cloudflare-access-loaded",
          clientId: metadata.client_id,
          serverUrl: account.server_url ?? "",
        });
      })
      .catch(() => {
        if (active && cloudflareAccessRequestIdRef.current === requestId && activeAccountIdRef.current === account.id) {
          dispatch({ type: "set-cloudflare-access-status", value: "error" });
        }
      });
    return () => {
      active = false;
    };
  }, [account.id, account.kind, account.server_url, activeAccountIdRef, cloudflareAccessRequestIdRef, dispatch]);
}
