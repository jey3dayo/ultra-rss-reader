import { Result } from "@praha/byethrow";
import { cleanup, renderHook } from "@testing-library/react";
import { setupBrowserTestDom } from "@tests/helpers/browser-test-globals";
import { createWrapper } from "@tests/helpers/create-wrapper";
import { createDeferred } from "@tests/helpers/deferred";
import { sampleAccounts } from "@tests/helpers/fixtures";
import i18n from "@tests/helpers/i18n-setup";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AppError } from "@/api/schemas";
import type { AccountDto } from "@/api/tauri-commands";
import { useAccountCredentialAccessCheck } from "@/components/reader/hooks/sidebar/use-account-credential-access-check";
import { useUiStore } from "@/stores/ui-store";

setupBrowserTestDom();

type ConnectionCheckResult = Result.Result<AccountDto, AppError>;

const { testAccountConnection } = vi.hoisted(() => ({
  testAccountConnection: vi.fn<(accountId: string) => Promise<ConnectionCheckResult>>(),
}));

vi.mock("@/api/tauri-commands", async () => ({
  ...(await vi.importActual<typeof import("@/api/tauri-commands")>("@/api/tauri-commands")),
  testAccountConnection,
}));

const account = { id: "acc-2", name: "FreshRSS" };
const verifiedAccount = sampleAccounts[1];

describe("useAccountCredentialAccessCheck", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
    useUiStore.setState(useUiStore.getInitialState());
    testAccountConnection.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("keeps account settings closed and confirms with a toast when the check succeeds", async () => {
    testAccountConnection.mockResolvedValue(Result.succeed(verifiedAccount));
    const { result } = renderHook(() => useAccountCredentialAccessCheck(), { wrapper: createWrapper() });

    await act(() => result.current.checkConnection(account));

    expect(useUiStore.getState().settingsAccountId).toBeNull();
    expect(useUiStore.getState().toastMessage?.message).toBe(
      "Connection to 'FreshRSS' confirmed. Automatic sync resumes.",
    );
    expect(result.current.isChecking(account.id)).toBe(false);
  });

  it.each([
    { cause: "canceled", guidance: "Access was canceled. Select the row again and allow it." },
    { cause: "not_allowed", guidance: "Access was not allowed. Select the row again and allow it." },
    { cause: "read_failed", guidance: "Credentials could not be read. Check the account settings." },
  ] as const)("explains a $cause credential failure without the raw backend message", async ({ cause, guidance }) => {
    testAccountConnection.mockResolvedValue(
      Result.fail({
        type: "UserVisible",
        message: "Keychain error: User canceled the operation.",
        credential_failure: { target: "password", cause },
      }),
    );
    const { result } = renderHook(() => useAccountCredentialAccessCheck(), { wrapper: createWrapper() });

    await act(() => result.current.checkConnection(account));

    expect(useUiStore.getState().settingsAccountId).toBe(account.id);
    expect(useUiStore.getState().toastMessage).toEqual({
      message: `Connection check failed for 'FreshRSS'. ${guidance}`,
      severity: "error",
    });
  });

  it("opens account settings with a toast when the command rejects", async () => {
    testAccountConnection.mockRejectedValue(new Error("IPC channel closed"));
    const { result } = renderHook(() => useAccountCredentialAccessCheck(), { wrapper: createWrapper() });

    await act(() => result.current.checkConnection(account));

    expect(useUiStore.getState().settingsAccountId).toBe(account.id);
    expect(useUiStore.getState().toastMessage).toEqual({
      message: "Connection check failed for 'FreshRSS': IPC channel closed",
      severity: "error",
    });
    expect(result.current.isChecking(account.id)).toBe(false);
  });

  it("runs one check per account while a check is in flight", async () => {
    const pending = createDeferred<ConnectionCheckResult>();
    testAccountConnection.mockReturnValue(pending.promise);
    const { result } = renderHook(() => useAccountCredentialAccessCheck(), { wrapper: createWrapper() });

    let first: Promise<void> = Promise.resolve();
    act(() => {
      first = result.current.checkConnection(account);
      void result.current.checkConnection(account);
    });

    expect(testAccountConnection).toHaveBeenCalledTimes(1);
    expect(result.current.isChecking(account.id)).toBe(true);

    await act(async () => {
      pending.resolve(Result.succeed(verifiedAccount));
      await first;
    });

    expect(result.current.isChecking(account.id)).toBe(false);
  });

  it("still opens account settings with the failure when the sidebar unmounts before the check fails", async () => {
    const pending = createDeferred<ConnectionCheckResult>();
    testAccountConnection.mockReturnValue(pending.promise);
    const { result, unmount } = renderHook(() => useAccountCredentialAccessCheck(), { wrapper: createWrapper() });

    let check: Promise<void> = Promise.resolve();
    act(() => {
      check = result.current.checkConnection(account);
    });
    unmount();
    pending.resolve(Result.fail({ type: "UserVisible", message: "Keychain access denied" }));
    await check;

    expect(useUiStore.getState().settingsAccountId).toBe(account.id);
    expect(useUiStore.getState().toastMessage?.message).toBe(
      "Connection check failed for 'FreshRSS': Keychain access denied",
    );
  });

  it("logs and allows another check when the failure feedback itself throws", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
    testAccountConnection.mockResolvedValue(Result.fail({ type: "UserVisible", message: "Keychain access denied" }));
    useUiStore.setState({
      showToast: () => {
        throw new Error("toast unavailable");
      },
    });
    const { result } = renderHook(() => useAccountCredentialAccessCheck(), { wrapper: createWrapper() });

    await act(() => result.current.checkConnection(account));
    expect(logged).toHaveBeenCalledWith("Failed to finish the credential access check:", expect.any(Error));
    expect(result.current.isChecking(account.id)).toBe(false);

    await act(() => result.current.checkConnection(account));
    expect(testAccountConnection).toHaveBeenCalledTimes(2);
    logged.mockRestore();
  });
});
