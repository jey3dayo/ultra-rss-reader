import { Result } from "@praha/byethrow";
import { act, renderHook } from "@testing-library/react";
import { createTestQueryClient } from "@tests/helpers/create-wrapper";
import { createDeferred } from "@tests/helpers/deferred";
import { sampleAccounts } from "@tests/helpers/fixtures";
import i18n from "@tests/helpers/i18n-setup";
import type { RefObject } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAccountDetailCredentialsEditor } from "@/components/settings/hooks/account-detail/use-account-detail-credentials-editor";
import { useUiStore } from "@/stores/ui-store";

const { copyToClipboardMock, testAccountConnectionMock, updateAccountCredentialsMock } = vi.hoisted(() => ({
  copyToClipboardMock: vi.fn(),
  testAccountConnectionMock: vi.fn(),
  updateAccountCredentialsMock: vi.fn(),
}));

vi.mock("@/api/tauri-commands", () => ({
  copyToClipboard: copyToClipboardMock,
  testAccountConnection: testAccountConnectionMock,
  updateAccountCredentials: updateAccountCredentialsMock,
}));

describe("useAccountDetailCredentialsEditor", () => {
  const t = i18n.getFixedT("en", "settings");

  beforeEach(() => {
    copyToClipboardMock.mockReset();
    testAccountConnectionMock.mockReset();
    updateAccountCredentialsMock.mockReset();
    useUiStore.setState(useUiStore.getInitialState());
  });

  afterEach(() => {
    useUiStore.setState(useUiStore.getInitialState());
    document.body.replaceChildren();
  });

  it("focuses and selects the first available credential input", () => {
    const account = sampleAccounts[1];
    const serverUrlInput = document.createElement("input");
    const usernameInput = document.createElement("input");
    serverUrlInput.value = "https://reader.example.com";
    usernameInput.value = "alice";
    document.body.append(serverUrlInput, usernameInput);

    const { result } = renderHook(() =>
      useAccountDetailCredentialsEditor({
        account,
        queryClient: createTestQueryClient(),
        t,
      }),
    );

    setInputRef(result.current.serverUrlInputRef, serverUrlInput);
    setInputRef(result.current.usernameInputRef, usernameInput);

    act(() => {
      result.current.focusCredentialsEditor();
    });

    expect(serverUrlInput).toHaveFocus();
    expect(serverUrlInput.selectionStart).toBe(0);
    expect(serverUrlInput.selectionEnd).toBe(serverUrlInput.value.length);
    expect(usernameInput).not.toHaveFocus();
  });

  it("falls back to the username input when the server URL input is unavailable", () => {
    const account = sampleAccounts[1];
    const usernameInput = document.createElement("input");
    usernameInput.value = "alice";
    document.body.append(usernameInput);

    const { result } = renderHook(() =>
      useAccountDetailCredentialsEditor({
        account,
        queryClient: createTestQueryClient(),
        t,
      }),
    );

    setInputRef(result.current.usernameInputRef, usernameInput);

    act(() => {
      result.current.focusCredentialsEditor();
    });

    expect(usernameInput).toHaveFocus();
    expect(usernameInput.selectionStart).toBe(0);
    expect(usernameInput.selectionEnd).toBe(usernameInput.value.length);
  });

  it("trims server URL and username before saving credentials", async () => {
    const account = sampleAccounts[1];
    updateAccountCredentialsMock.mockResolvedValue(
      Result.succeed({
        ...account,
        server_url: "https://reader.example.com",
        username: "alice",
      }),
    );

    const { result } = renderHook(() =>
      useAccountDetailCredentialsEditor({
        account,
        queryClient: createTestQueryClient(),
        t,
      }),
    );

    act(() => {
      result.current.setCredServerUrl("  https://reader.example.com  ");
      result.current.setCredUsername("  alice  ");
    });

    await act(async () => {
      await result.current.commitCredentials();
    });

    expect(updateAccountCredentialsMock).toHaveBeenCalledWith(
      "acc-2",
      "https://reader.example.com",
      "alice",
      undefined,
    );
  });

  it("trims the copied server URL and skips whitespace-only drafts", async () => {
    const account = {
      ...sampleAccounts[1],
      server_url: "  https://freshrss.example.com/api  ",
    };
    copyToClipboardMock.mockResolvedValue(Result.succeed(null));

    const { result } = renderHook(() =>
      useAccountDetailCredentialsEditor({
        account,
        queryClient: createTestQueryClient(),
        t,
      }),
    );

    await act(async () => {
      await result.current.handleCopyServerUrl();
    });

    expect(copyToClipboardMock).toHaveBeenCalledWith("https://freshrss.example.com/api");

    act(() => {
      result.current.setCredServerUrl("  https://draft.example.com/api  ");
    });
    await act(async () => {
      await result.current.handleCopyServerUrl();
    });

    expect(copyToClipboardMock).toHaveBeenLastCalledWith("https://draft.example.com/api");

    act(() => {
      result.current.setCredServerUrl("   ");
    });
    await act(async () => {
      await result.current.handleCopyServerUrl();
    });

    expect(copyToClipboardMock).toHaveBeenCalledTimes(2);
  });

  it("blocks credential save and connection test when the server URL is invalid", async () => {
    const account = sampleAccounts[1];
    const { result } = renderHook(() =>
      useAccountDetailCredentialsEditor({
        account,
        queryClient: createTestQueryClient(),
        t,
      }),
    );

    act(() => {
      result.current.setCredServerUrl("not a url");
      result.current.setCredUsername("alice");
    });

    let saved = true;
    await act(async () => {
      saved = await result.current.commitCredentials();
    });

    expect(saved).toBe(false);
    expect(updateAccountCredentialsMock).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.handleTestConnection();
    });

    expect(testAccountConnectionMock).not.toHaveBeenCalled();
  });

  it("surfaces rejected credential saves, keeps drafts, and allows retry", async () => {
    const account = sampleAccounts[1];
    updateAccountCredentialsMock.mockRejectedValueOnce(new Error("keychain unavailable")).mockResolvedValueOnce(
      Result.succeed({
        ...account,
        server_url: "https://reader.example.com",
        username: "alice",
      }),
    );

    const { result } = renderHook(() =>
      useAccountDetailCredentialsEditor({
        account,
        queryClient: createTestQueryClient(),
        t,
      }),
    );

    act(() => {
      result.current.setCredServerUrl("https://reader.example.com");
      result.current.setCredUsername("alice");
    });

    let firstSaved = true;
    await act(async () => {
      firstSaved = await result.current.commitCredentials();
    });

    expect(firstSaved).toBe(false);
    expect(useUiStore.getState().toastMessage?.message).toBe("Failed to update sync settings: keychain unavailable");
    expect(result.current.credServerUrl).toBe("https://reader.example.com");
    expect(result.current.credUsername).toBe("alice");

    let secondSaved = false;
    await act(async () => {
      secondSaved = await result.current.commitCredentials();
    });

    expect(secondSaved).toBe(true);
    expect(updateAccountCredentialsMock).toHaveBeenCalledTimes(2);
  });

  it("does not start a connection test after a rejected credential save", async () => {
    const account = sampleAccounts[1];
    updateAccountCredentialsMock.mockRejectedValue(new Error("keychain unavailable"));

    const { result } = renderHook(() =>
      useAccountDetailCredentialsEditor({
        account,
        queryClient: createTestQueryClient(),
        t,
      }),
    );

    act(() => {
      result.current.setCredUsername("alice");
    });

    await act(async () => {
      await result.current.handleTestConnection();
    });

    expect(testAccountConnectionMock).not.toHaveBeenCalled();
    expect(result.current.testingConnection).toBe(false);
  });

  it("ignores a stale connection success when the draft changes before the result returns", async () => {
    const account = sampleAccounts[1];
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(["accounts"], [account]);
    const staleConnection = createDeferred<ReturnType<typeof testAccountConnectionMock>>();
    testAccountConnectionMock.mockReturnValue(staleConnection.promise);

    const { result } = renderHook(() =>
      useAccountDetailCredentialsEditor({
        account,
        queryClient,
        t,
      }),
    );

    let testConnection: Promise<void> = Promise.resolve();
    await act(async () => {
      testConnection = result.current.handleTestConnection();
      await Promise.resolve();
    });
    expect(testAccountConnectionMock).toHaveBeenCalledWith(account.id);

    act(() => {
      result.current.setCredUsername("new-draft");
    });

    await act(async () => {
      staleConnection.resolve(Result.succeed({ ...account, username: "stale-user" }));
      await testConnection;
    });

    expect(queryClient.getQueryData(["accounts"])).toEqual([account]);
    expect(useUiStore.getState().toastMessage).toBeNull();
    expect(result.current.credUsername).toBe("new-draft");
    expect(result.current.testingConnection).toBe(false);
  });

  it("ignores a stale connection failure after switching accounts", async () => {
    const firstAccount = { ...sampleAccounts[1], id: "acc-1", name: "FreshRSS Work" };
    const secondAccount = { ...sampleAccounts[0], id: "acc-2", name: "Local Account" };
    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const staleConnection = createDeferred<ReturnType<typeof testAccountConnectionMock>>();
    testAccountConnectionMock.mockReturnValue(staleConnection.promise);

    const { result, rerender } = renderHook(
      ({ account }) =>
        useAccountDetailCredentialsEditor({
          account,
          queryClient,
          t,
        }),
      { initialProps: { account: firstAccount } },
    );

    let testConnection: Promise<void> = Promise.resolve();
    await act(async () => {
      testConnection = result.current.handleTestConnection();
      await Promise.resolve();
    });
    expect(testAccountConnectionMock).toHaveBeenCalledWith(firstAccount.id);

    rerender({ account: secondAccount });

    await act(async () => {
      staleConnection.resolve(Result.fail({ message: "stale failure" }));
      await testConnection;
    });

    expect(useUiStore.getState().toastMessage).toBeNull();
    expect(invalidateSpy).not.toHaveBeenCalled();
    expect(result.current.testingConnection).toBe(false);
  });

  it("does not apply a stale credential save when the draft changes before the save returns", async () => {
    const account = sampleAccounts[1];
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(["accounts"], [account]);
    const staleSave = createDeferred<ReturnType<typeof updateAccountCredentialsMock>>();
    updateAccountCredentialsMock.mockReturnValue(staleSave.promise);

    const { result } = renderHook(() =>
      useAccountDetailCredentialsEditor({
        account,
        queryClient,
        t,
      }),
    );

    act(() => {
      result.current.setCredUsername("stale-user");
    });
    const saveCredentials = result.current.commitCredentials();

    act(() => {
      result.current.setCredUsername("current-draft");
    });

    await act(async () => {
      staleSave.resolve(Result.succeed({ ...account, username: "stale-user" }));
      await saveCredentials;
    });

    expect(queryClient.getQueryData(["accounts"])).toEqual([account]);
    expect(useUiStore.getState().toastMessage).toBeNull();
    expect(result.current.credUsername).toBe("current-draft");
  });

  it("does not test a stale account after credential persistence finishes on a previous account", async () => {
    const firstAccount = { ...sampleAccounts[1], id: "acc-1", name: "FreshRSS Work" };
    const secondAccount = { ...sampleAccounts[1], id: "acc-2", name: "FreshRSS Personal" };
    const staleSave = createDeferred<ReturnType<typeof updateAccountCredentialsMock>>();
    updateAccountCredentialsMock.mockReturnValue(staleSave.promise);

    const { result, rerender } = renderHook(
      ({ account }) =>
        useAccountDetailCredentialsEditor({
          account,
          queryClient: createTestQueryClient(),
          t,
        }),
      { initialProps: { account: firstAccount } },
    );

    act(() => {
      result.current.setCredUsername("alice");
    });
    const testConnection = result.current.handleTestConnection();

    rerender({ account: secondAccount });

    await act(async () => {
      staleSave.resolve(Result.succeed({ ...firstAccount, username: "alice" }));
      await testConnection;
    });

    expect(updateAccountCredentialsMock).toHaveBeenCalledWith(
      firstAccount.id,
      firstAccount.server_url,
      "alice",
      undefined,
    );
    expect(testAccountConnectionMock).not.toHaveBeenCalled();
    expect(useUiStore.getState().toastMessage).toBeNull();
  });

  it("keeps the masked password for a FreshRSS account with a non-keyring verification error", () => {
    const account = {
      ...sampleAccounts[1],
      connection_verification_status: "error" as const,
      connection_verification_error: "Auth error: invalid credentials",
    };

    const { result } = renderHook(() =>
      useAccountDetailCredentialsEditor({
        account,
        queryClient: createTestQueryClient(),
        t,
      }),
    );

    expect(result.current.passwordDisplayValue).toBe("••••••••");
  });

  it("does not show the masked password for a FreshRSS account with a missing saved password", () => {
    const account = {
      ...sampleAccounts[1],
      connection_verification_status: "error" as const,
      connection_verification_error:
        "Validation error: Password is not configured. Re-enter your password in account settings, save it, and try again.",
    };

    const { result } = renderHook(() =>
      useAccountDetailCredentialsEditor({
        account,
        queryClient: createTestQueryClient(),
        t,
      }),
    );

    expect(result.current.passwordDisplayValue).toBe("");
  });
});

function setInputRef(ref: RefObject<HTMLInputElement | null>, input: HTMLInputElement): void {
  Object.defineProperty(ref, "current", {
    configurable: true,
    value: input,
  });
}
