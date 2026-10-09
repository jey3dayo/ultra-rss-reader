import "@testing-library/jest-dom/vitest";
import { Result } from "@praha/byethrow";
import { act, renderHook, waitFor } from "@testing-library/react";
import { setupBrowserTestDom } from "@tests/helpers/browser-test-globals";
import { suppressConsoleWarn } from "@tests/helpers/console-spies";
import { createTestQueryClient } from "@tests/helpers/create-wrapper";
import { createDeferred } from "@tests/helpers/deferred";
import { sampleAccounts } from "@tests/helpers/fixtures";
import i18n from "@tests/helpers/i18n-setup";
import { resetTauriRuntimeFlags, setTauriRuntimeMissing, setTauriRuntimePresent } from "@tests/helpers/tauri-runtime";
import type { RefObject } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAccountDetailCredentialsEditor } from "@/components/settings/hooks/account-detail/use-account-detail-credentials-editor";
import { queryKeys } from "@/lib/query/query-invalidation";
import { useUiStore } from "@/stores/ui-store";

const { copyToClipboardMock, getAccountCloudflareAccessMock, testAccountConnectionMock, updateAccountCredentialsMock } =
  vi.hoisted(() => ({
    copyToClipboardMock: vi.fn(),
    getAccountCloudflareAccessMock: vi.fn(),
    testAccountConnectionMock: vi.fn(),
    updateAccountCredentialsMock: vi.fn(),
  }));

vi.mock("@/api/tauri-commands", () => ({
  copyToClipboard: copyToClipboardMock,
  getAccountCloudflareAccess: getAccountCloudflareAccessMock,
  testAccountConnection: testAccountConnectionMock,
  updateAccountCredentials: updateAccountCredentialsMock,
}));

setupBrowserTestDom();

describe("useAccountDetailCredentialsEditor", () => {
  const t = i18n.getFixedT("en", "settings");

  beforeEach(() => {
    setTauriRuntimeMissing();
    copyToClipboardMock.mockReset();
    getAccountCloudflareAccessMock.mockReset();
    getAccountCloudflareAccessMock.mockResolvedValue(Result.succeed({ client_id: null }));
    testAccountConnectionMock.mockReset();
    updateAccountCredentialsMock.mockReset();
    testAccountConnectionMock.mockImplementation((accountId: string) =>
      Result.succeed({
        ...sampleAccounts[1],
        id: accountId,
        connection_verification_status: "verified",
        connection_verified_at: "2026-04-19T05:32:00Z",
        connection_verification_error: null,
      }),
    );
    useUiStore.setState(useUiStore.getInitialState());
  });

  afterEach(() => {
    vi.restoreAllMocks();
    useUiStore.setState(useUiStore.getInitialState());
    document.body.replaceChildren();
    resetTauriRuntimeFlags();
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

  it("saves a dirty draft and verifies exactly once from the explicit action", async () => {
    setTauriRuntimePresent();
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

    await waitFor(() => expect(result.current.cloudflareAccessStatus).toBe("ready"));

    act(() => {
      result.current.setCredServerUrl("  https://reader.example.com  ");
      result.current.setCredUsername("  alice  ");
    });

    await act(async () => {
      await result.current.handleTestConnection();
    });

    expect(updateAccountCredentialsMock).toHaveBeenCalledWith(
      "acc-2",
      "https://reader.example.com",
      "alice",
      undefined,
    );
    expect(testAccountConnectionMock).toHaveBeenCalledWith("acc-2");
  });

  it("loads only the saved Access Client ID and keeps a blank Secret unchanged", async () => {
    setTauriRuntimePresent();
    const account = sampleAccounts[1];
    getAccountCloudflareAccessMock.mockResolvedValue(Result.succeed({ client_id: "saved-client-id" }));
    updateAccountCredentialsMock.mockResolvedValue(Result.succeed({ ...account, username: "reader" }));

    const { result } = renderHook(() =>
      useAccountDetailCredentialsEditor({ account, queryClient: createTestQueryClient(), t }),
    );

    await waitFor(() => {
      expect(result.current.cloudflareAccessStatus).toBe("ready");
      expect(result.current.cloudflareAccessEnabled).toBe(true);
      expect(result.current.cloudflareAccessClientId).toBe("saved-client-id");
      expect(result.current.cloudflareAccessSecret).toBe("");
    });

    act(() => {
      result.current.setCredUsername("reader");
    });
    await act(async () => {
      await result.current.commitCredentials();
    });

    expect(updateAccountCredentialsMock).toHaveBeenCalledWith(account.id, account.server_url, "reader", undefined);
    expect(result.current.cloudflareAccessSecret).toBe("");
  });

  it.each(["username", "password", "server URL"])(
    "keeps saved Access when %s changes before metadata resolves",
    async (field) => {
      setTauriRuntimePresent();
      const account = sampleAccounts[1];
      const metadata = createDeferred<Result.Result<{ client_id: string }, never>>();
      getAccountCloudflareAccessMock.mockReturnValue(metadata.promise);
      updateAccountCredentialsMock.mockResolvedValue(Result.succeed(account));
      const { result } = renderHook(() =>
        useAccountDetailCredentialsEditor({ account, queryClient: createTestQueryClient(), t }),
      );

      act(() => {
        if (field === "username") result.current.setCredUsername("reader");
        if (field === "password") result.current.setCredPassword("dummy-password");
        if (field === "server URL") result.current.setCredServerUrl(`${account.server_url}/changed-path`);
      });
      await act(async () => metadata.resolve(Result.succeed({ client_id: "saved-dummy-id" })));
      await act(async () => {
        await result.current.commitCredentials();
      });

      expect(updateAccountCredentialsMock).toHaveBeenCalledWith(
        account.id,
        field === "server URL" ? `${account.server_url}/changed-path` : account.server_url,
        field === "username" ? "reader" : account.username,
        field === "password" ? "dummy-password" : undefined,
      );
      expect(result.current.cloudflareAccessEnabled).toBe(true);
      expect(result.current.cloudflareAccessClientId).toBe("saved-dummy-id");
      expect(result.current.cloudflareAccessSecret).toBe("");
    },
  );

  it("does not remove Access after password focus while metadata is pending", async () => {
    setTauriRuntimePresent();
    const metadata = createDeferred<Result.Result<{ client_id: string }, never>>();
    getAccountCloudflareAccessMock.mockReturnValue(metadata.promise);
    updateAccountCredentialsMock.mockResolvedValue(Result.succeed(sampleAccounts[1]));
    const { result } = renderHook(() =>
      useAccountDetailCredentialsEditor({ account: sampleAccounts[1], queryClient: createTestQueryClient(), t }),
    );
    act(() => result.current.onPasswordFocus());
    await act(async () => metadata.resolve(Result.succeed({ client_id: "saved-dummy-id" })));
    await act(async () => {
      await result.current.commitCredentials();
    });
    expect(updateAccountCredentialsMock).not.toHaveBeenCalled();
    expect(result.current.cloudflareAccessEnabled).toBe(true);
    expect(result.current.dirtyState.dirty).toBe(false);
  });

  it("restores the saved password mask on blur without saving or testing", () => {
    const account = sampleAccounts[1];
    const { result } = renderHook(() =>
      useAccountDetailCredentialsEditor({ account, queryClient: createTestQueryClient(), t }),
    );

    act(() => result.current.onPasswordFocus());
    expect(result.current.passwordDisplayValue).toBe("");
    act(() => result.current.onPasswordBlur());

    expect(result.current.passwordDisplayValue).toBe("••••••••");
    expect(result.current.dirtyState.dirty).toBe(false);
    expect(updateAccountCredentialsMock).not.toHaveBeenCalled();
    expect(testAccountConnectionMock).not.toHaveBeenCalled();
  });

  it("preserves explicit Access replacement edits made before metadata resolves", async () => {
    setTauriRuntimePresent();
    const account = sampleAccounts[1];
    const metadata = createDeferred<Result.Result<{ client_id: string }, never>>();
    getAccountCloudflareAccessMock.mockReturnValue(metadata.promise);
    updateAccountCredentialsMock.mockResolvedValue(Result.succeed(account));
    const { result } = renderHook(() =>
      useAccountDetailCredentialsEditor({ account, queryClient: createTestQueryClient(), t }),
    );
    act(() => {
      result.current.setCloudflareAccessEnabled(true);
      result.current.setCloudflareAccessClientId("new-dummy-id");
      result.current.setCloudflareAccessSecret("new-dummy-secret");
    });
    await act(async () => metadata.resolve(Result.succeed({ client_id: "saved-dummy-id" })));
    expect(result.current.cloudflareAccessClientId).toBe("new-dummy-id");
    expect(result.current.cloudflareAccessSecret).toBe("new-dummy-secret");
    await act(async () => {
      await result.current.commitCredentials();
    });
    expect(updateAccountCredentialsMock).toHaveBeenCalledWith(
      account.id,
      account.server_url,
      account.username,
      undefined,
      { action: "replace", clientId: "new-dummy-id", clientSecret: "new-dummy-secret" },
    );
  });

  it("preserves explicit removal selected while metadata is pending", async () => {
    setTauriRuntimePresent();
    const account = sampleAccounts[1];
    const metadata = createDeferred<Result.Result<{ client_id: string }, never>>();
    getAccountCloudflareAccessMock.mockReturnValue(metadata.promise);
    updateAccountCredentialsMock.mockResolvedValue(Result.succeed(account));
    const { result } = renderHook(() =>
      useAccountDetailCredentialsEditor({ account, queryClient: createTestQueryClient(), t }),
    );
    act(() => result.current.setCloudflareAccessEnabled(false));
    await act(async () => metadata.resolve(Result.succeed({ client_id: "saved-dummy-id" })));
    await act(async () => {
      await result.current.commitCredentials();
    });
    expect(updateAccountCredentialsMock).toHaveBeenCalledWith(
      account.id,
      account.server_url,
      account.username,
      undefined,
      { action: "remove" },
    );
  });

  it("requires Secret reentry after an origin edit made before metadata resolves", async () => {
    setTauriRuntimePresent();
    const metadata = createDeferred<Result.Result<{ client_id: string }, never>>();
    getAccountCloudflareAccessMock.mockReturnValue(metadata.promise);
    const { result } = renderHook(() =>
      useAccountDetailCredentialsEditor({ account: sampleAccounts[1], queryClient: createTestQueryClient(), t }),
    );
    act(() => result.current.setCredServerUrl("https://different.example.com"));
    await act(async () => metadata.resolve(Result.succeed({ client_id: "saved-dummy-id" })));
    await act(async () => {
      expect(await result.current.commitCredentials()).toBe(false);
    });
    expect(result.current.cloudflareAccessEnabled).toBe(true);
    expect(result.current.cloudflareAccessValidationError).toBe("client_secret_required");
    expect(updateAccountCredentialsMock).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.handleTestConnection();
    });
    expect(updateAccountCredentialsMock).not.toHaveBeenCalled();
    expect(testAccountConnectionMock).not.toHaveBeenCalled();
  });

  it.each(["replace", "remove"] satisfies Array<"replace" | "remove">)(
    "ignores metadata read before a newer Access %s save completed",
    async (action) => {
      setTauriRuntimePresent();
      const account = sampleAccounts[1];
      const queryClient = createTestQueryClient();
      const metadata = createDeferred<Result.Result<{ client_id: string }, never>>();
      const save = createDeferred<Result.Result<typeof account, never>>();
      getAccountCloudflareAccessMock.mockResolvedValueOnce(Result.succeed({ client_id: "old-dummy-id" }));
      updateAccountCredentialsMock.mockReturnValueOnce(save.promise).mockResolvedValue(Result.succeed(account));
      const { result, rerender } = renderHook(
        ({ account }) => useAccountDetailCredentialsEditor({ account, queryClient, t }),
        { initialProps: { account } },
      );
      await waitFor(() => expect(result.current.cloudflareAccessStatus).toBe("ready"));
      act(() => {
        if (action === "replace") {
          result.current.setCloudflareAccessClientId("new-dummy-id");
          result.current.setCloudflareAccessSecret("new-dummy-secret");
        } else {
          result.current.setCloudflareAccessEnabled(false);
        }
      });
      let pendingSave: Promise<boolean> = Promise.resolve(false);
      act(() => {
        pendingSave = result.current.commitCredentials();
      });
      getAccountCloudflareAccessMock.mockReturnValueOnce(metadata.promise);
      rerender({ account: { ...account, server_url: `${account.server_url}/new-path` } });
      await waitFor(() => expect(result.current.cloudflareAccessStatus).toBe("loading"));
      await act(async () => {
        save.resolve(Result.succeed(account));
        expect(await pendingSave).toBe(true);
      });
      await act(async () => metadata.resolve(Result.succeed({ client_id: "old-dummy-id" })));
      expect(result.current.cloudflareAccessStatus).toBe("ready");
      expect(result.current.cloudflareAccessEnabled).toBe(action === "replace");
      expect(result.current.cloudflareAccessClientId).toBe(action === "replace" ? "new-dummy-id" : "");
      expect(result.current.cloudflareAccessSecret).toBe("");
      act(() => result.current.setCredUsername("reader"));
      await act(async () => {
        await result.current.commitCredentials();
      });
      expect(updateAccountCredentialsMock).toHaveBeenLastCalledWith(
        account.id,
        `${account.server_url}/new-path`,
        "reader",
        undefined,
      );
    },
  );

  it("requires a replacement Secret for ID or origin changes and sends the full replacement", async () => {
    setTauriRuntimePresent();
    const account = sampleAccounts[1];
    getAccountCloudflareAccessMock.mockResolvedValue(Result.succeed({ client_id: "saved-client-id" }));
    updateAccountCredentialsMock.mockResolvedValue(
      Result.succeed({ ...account, server_url: "https://other.example.com" }),
    );

    const { result } = renderHook(() =>
      useAccountDetailCredentialsEditor({ account, queryClient: createTestQueryClient(), t }),
    );
    await waitFor(() => expect(result.current.cloudflareAccessStatus).toBe("ready"));

    act(() => {
      result.current.setCloudflareAccessClientId("new-client-id");
    });
    expect(result.current.cloudflareAccessValidationError).toBe("client_secret_required");
    let saved = true;
    await act(async () => {
      saved = await result.current.commitCredentials();
    });
    expect(saved).toBe(false);
    expect(updateAccountCredentialsMock).not.toHaveBeenCalled();

    act(() => {
      result.current.setCloudflareAccessSecret("dummy-access-secret");
      result.current.setCredServerUrl("https://other.example.com");
    });
    expect(result.current.cloudflareAccessValidationError).toBeNull();
    await act(async () => {
      saved = await result.current.commitCredentials();
    });

    expect(saved).toBe(true);
    expect(updateAccountCredentialsMock).toHaveBeenCalledWith(
      account.id,
      "https://other.example.com",
      account.username,
      undefined,
      {
        action: "replace",
        clientId: "new-client-id",
        clientSecret: "dummy-access-secret",
      },
    );
    expect(result.current.cloudflareAccessSecret).toBe("");
  });

  it("removes saved Access only after the switch is explicitly turned off", async () => {
    setTauriRuntimePresent();
    const account = sampleAccounts[1];
    getAccountCloudflareAccessMock.mockResolvedValue(Result.succeed({ client_id: "saved-client-id" }));
    updateAccountCredentialsMock.mockResolvedValue(Result.succeed(account));
    const { result } = renderHook(() =>
      useAccountDetailCredentialsEditor({ account, queryClient: createTestQueryClient(), t }),
    );
    await waitFor(() => expect(result.current.cloudflareAccessEnabled).toBe(true));

    act(() => {
      result.current.setCloudflareAccessEnabled(false);
    });
    await act(async () => {
      await result.current.commitCredentials();
    });

    expect(updateAccountCredentialsMock).toHaveBeenCalledWith(
      account.id,
      account.server_url,
      account.username,
      undefined,
      {
        action: "remove",
      },
    );
    expect(result.current.cloudflareAccessEnabled).toBe(false);
  });

  it("surfaces Access metadata read errors and preserves Access on unrelated credential saves", async () => {
    setTauriRuntimePresent();
    const account = sampleAccounts[1];
    getAccountCloudflareAccessMock.mockResolvedValue(
      Result.fail({ type: "UserVisible", message: "keyring unavailable" }),
    );
    updateAccountCredentialsMock.mockResolvedValue(Result.succeed({ ...account, username: "reader" }));
    const { result } = renderHook(() =>
      useAccountDetailCredentialsEditor({ account, queryClient: createTestQueryClient(), t }),
    );

    await waitFor(() => expect(result.current.cloudflareAccessStatus).toBe("error"));
    act(() => {
      result.current.setCredUsername("reader");
    });
    await act(async () => {
      await result.current.commitCredentials();
    });
    expect(updateAccountCredentialsMock).toHaveBeenCalledWith(account.id, account.server_url, "reader", undefined);
    updateAccountCredentialsMock.mockClear();

    act(() => {
      result.current.setCredServerUrl("https://different.example.com");
    });
    let saved = true;
    await act(async () => {
      saved = await result.current.commitCredentials();
    });
    expect(saved).toBe(false);
    expect(updateAccountCredentialsMock).not.toHaveBeenCalled();
    expect(useUiStore.getState().toastMessage?.message).toBe(
      t("account.cloudflare_access_metadata_required_for_origin_change"),
    );
    expect(result.current.cloudflareAccessStatus).toBe("error");
  });

  it("requires both new Access credentials to recover unreadable metadata and retains drafts on save failure", async () => {
    setTauriRuntimePresent();
    const account = sampleAccounts[1];
    getAccountCloudflareAccessMock.mockResolvedValue(Result.fail({ type: "UserVisible", message: "invalid bundle" }));
    updateAccountCredentialsMock.mockResolvedValue(
      Result.fail({ type: "UserVisible", message: "keyring unavailable" }),
    );
    const { result } = renderHook(() =>
      useAccountDetailCredentialsEditor({ account, queryClient: createTestQueryClient(), t }),
    );
    await waitFor(() => expect(result.current.cloudflareAccessStatus).toBe("error"));

    act(() => {
      result.current.setCloudflareAccessRecoveryAction("replace");
      result.current.setCloudflareAccessClientId("replacement-client");
    });
    expect(result.current.dirtyState.dirty).toBe(true);
    expect(result.current.cloudflareAccessValidationError).toBe("client_secret_required");
    await act(async () => {
      expect(await result.current.commitCredentials()).toBe(false);
    });
    expect(updateAccountCredentialsMock).not.toHaveBeenCalled();

    act(() => {
      result.current.setCloudflareAccessSecret("dummy-recovery-secret");
      result.current.setCredServerUrl("https://new.example.com");
    });
    await act(async () => {
      expect(await result.current.commitCredentials()).toBe(false);
    });
    expect(updateAccountCredentialsMock).toHaveBeenCalledWith(
      account.id,
      "https://new.example.com",
      account.username,
      undefined,
      {
        action: "replace",
        clientId: "replacement-client",
        clientSecret: "dummy-recovery-secret",
      },
    );
    expect(result.current.cloudflareAccessStatus).toBe("error");
    expect(result.current.cloudflareAccessRecoveryAction).toBe("replace");
    expect(result.current.cloudflareAccessClientId).toBe("replacement-client");
    expect(result.current.cloudflareAccessSecret).toBe("dummy-recovery-secret");
    expect(result.current.dirtyState.dirty).toBe(true);

    updateAccountCredentialsMock.mockResolvedValue(
      Result.succeed({ ...account, server_url: "https://new.example.com" }),
    );
    await act(async () => {
      expect(await result.current.commitCredentials()).toBe(true);
    });
    expect(result.current.cloudflareAccessStatus).toBe("ready");
    expect(result.current.cloudflareAccessRecoveryAction).toBeNull();
    expect(result.current.cloudflareAccessEnabled).toBe(true);
    expect(result.current.cloudflareAccessSecret).toBe("");
  });

  it("removes unreadable Access only after a deliberate selection and retains that selection on failure", async () => {
    setTauriRuntimePresent();
    const account = sampleAccounts[1];
    getAccountCloudflareAccessMock.mockRejectedValue(new Error("invalid bundle"));
    updateAccountCredentialsMock.mockResolvedValue(
      Result.fail({ type: "UserVisible", message: "keyring unavailable" }),
    );
    const { result } = renderHook(() =>
      useAccountDetailCredentialsEditor({ account, queryClient: createTestQueryClient(), t }),
    );
    await waitFor(() => expect(result.current.cloudflareAccessStatus).toBe("error"));
    await act(async () => {
      expect(await result.current.commitCredentials()).toBe(true);
    });
    expect(updateAccountCredentialsMock).not.toHaveBeenCalled();
    expect(result.current.cloudflareAccessStatus).toBe("error");
    act(() => result.current.setCloudflareAccessRecoveryAction("remove"));
    await act(async () => {
      expect(await result.current.commitCredentials()).toBe(false);
    });
    expect(updateAccountCredentialsMock).toHaveBeenCalledWith(
      account.id,
      account.server_url,
      account.username,
      undefined,
      { action: "remove" },
    );
    expect(result.current.cloudflareAccessStatus).toBe("error");
    expect(result.current.cloudflareAccessRecoveryAction).toBe("remove");
    expect(result.current.dirtyState.dirty).toBe(true);

    updateAccountCredentialsMock.mockResolvedValue(Result.succeed(account));
    await act(async () => {
      expect(await result.current.commitCredentials()).toBe(true);
    });
    expect(result.current.cloudflareAccessStatus).toBe("ready");
    expect(result.current.cloudflareAccessEnabled).toBe(false);
    expect(result.current.dirtyState.dirty).toBe(false);
  });

  it("reads Access metadata in the installed built-in browser mock runtime", async () => {
    window.__DEV_BROWSER_MOCKS__ = true;
    window.__ULTRA_RSS_BROWSER_MOCKS__ = true;
    window.__TAURI_INTERNALS__ = { invoke: vi.fn() };
    getAccountCloudflareAccessMock.mockResolvedValue(Result.succeed({ client_id: "preview-client" }));
    const { result } = renderHook(() =>
      useAccountDetailCredentialsEditor({ account: sampleAccounts[1], queryClient: createTestQueryClient(), t }),
    );
    await waitFor(() => expect(result.current.cloudflareAccessStatus).toBe("ready"));
    expect(result.current.cloudflareAccessClientId).toBe("preview-client");
  });

  it("guards Access metadata when mock flags exist without an installed IPC runtime", async () => {
    window.__DEV_BROWSER_MOCKS__ = true;
    window.__ULTRA_RSS_BROWSER_MOCKS__ = true;
    const { result } = renderHook(() =>
      useAccountDetailCredentialsEditor({ account: sampleAccounts[1], queryClient: createTestQueryClient(), t }),
    );
    await waitFor(() => expect(result.current.cloudflareAccessStatus).toBe("unavailable"));
    expect(getAccountCloudflareAccessMock).not.toHaveBeenCalled();
  });

  it("ignores metadata reads when Tauri is unavailable in browser preview", async () => {
    setTauriRuntimeMissing();
    const { result } = renderHook(() =>
      useAccountDetailCredentialsEditor({
        account: sampleAccounts[1],
        queryClient: createTestQueryClient(),
        t,
      }),
    );

    await waitFor(() => expect(result.current.cloudflareAccessStatus).toBe("unavailable"));
    expect(getAccountCloudflareAccessMock).not.toHaveBeenCalled();
  });

  it.each(["ready", "error"] as const)(
    "does not let a stale Access save clear a newer local Secret draft from metadata state %s",
    async (metadataStatus) => {
      setTauriRuntimePresent();
      const account = sampleAccounts[1];
      getAccountCloudflareAccessMock.mockResolvedValue(
        metadataStatus === "ready"
          ? Result.succeed({ client_id: "saved-client-id" })
          : Result.fail({ type: "UserVisible", message: "invalid bundle" }),
      );
      const staleSave = createDeferred<ReturnType<typeof updateAccountCredentialsMock>>();
      updateAccountCredentialsMock.mockReturnValue(staleSave.promise);
      const { result } = renderHook(() =>
        useAccountDetailCredentialsEditor({ account, queryClient: createTestQueryClient(), t }),
      );
      await waitFor(() => expect(result.current.cloudflareAccessStatus).toBe(metadataStatus));

      act(() => {
        if (metadataStatus === "error") {
          result.current.setCloudflareAccessRecoveryAction("replace");
          result.current.setCloudflareAccessClientId("replacement-client");
        }
        result.current.setCloudflareAccessSecret("first-dummy-secret");
      });
      const pendingSave = result.current.commitCredentials();
      await waitFor(() =>
        expect(updateAccountCredentialsMock).toHaveBeenCalledWith(
          account.id,
          account.server_url,
          account.username,
          undefined,
          expect.objectContaining({ action: "replace", clientSecret: "first-dummy-secret" }),
        ),
      );

      act(() => {
        result.current.setCloudflareAccessSecret("newer-dummy-secret");
      });
      staleSave.resolve(Result.succeed(account));
      await act(async () => {
        await pendingSave;
      });

      expect(result.current.cloudflareAccessSecret).toBe("newer-dummy-secret");
    },
  );

  it("returns the shared dirty-state shape for credential drafts", () => {
    const account = sampleAccounts[1];
    const { result } = renderHook(() =>
      useAccountDetailCredentialsEditor({
        account,
        queryClient: createTestQueryClient(),
        t,
      }),
    );

    expect(result.current.dirtyState).toEqual({
      owner: "account",
      dirty: false,
      pending: false,
      blockingReason: null,
    });

    act(() => {
      result.current.setCredUsername("alice");
    });

    expect(result.current.dirtyState).toEqual({
      owner: "account",
      dirty: true,
      pending: false,
      blockingReason: "account-credentials-dirty",
    });
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
    setTauriRuntimePresent();
    const account = sampleAccounts[1];
    const { result } = renderHook(() =>
      useAccountDetailCredentialsEditor({
        account,
        queryClient: createTestQueryClient(),
        t,
      }),
    );

    await waitFor(() => expect(result.current.cloudflareAccessStatus).toBe("ready"));

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

  it.each([
    { field: "username", value: "", toastKey: "account.error_username_required" },
    { field: "username", value: "   ", toastKey: "account.error_username_required" },
    { field: "server URL", value: "", toastKey: "account.error_server_url_required" },
    { field: "server URL", value: "   ", toastKey: "account.error_server_url_required" },
  ] as const)(
    "keeps credential edits and skips save and test when $field is blank",
    async ({ field, value, toastKey }) => {
      setTauriRuntimePresent();
      const account = sampleAccounts[1];
      updateAccountCredentialsMock.mockResolvedValue(Result.succeed(account));
      testAccountConnectionMock.mockResolvedValue(Result.succeed(account));
      const { result } = renderHook(() =>
        useAccountDetailCredentialsEditor({ account, queryClient: createTestQueryClient(), t }),
      );

      await waitFor(() => expect(result.current.cloudflareAccessStatus).toBe("ready"));

      act(() => {
        if (field === "username") result.current.setCredUsername(value);
        if (field === "server URL") result.current.setCredServerUrl(value);
        result.current.setCredPassword("changed-dummy-password");
      });

      await act(async () => {
        await result.current.handleTestConnection();
      });

      expect(updateAccountCredentialsMock).not.toHaveBeenCalled();
      expect(testAccountConnectionMock).not.toHaveBeenCalled();
      expect(result.current.credUsername).toBe(field === "username" ? value : null);
      expect(result.current.credServerUrl).toBe(field === "server URL" ? value : null);
      expect(result.current.credPassword).toBe("changed-dummy-password");
      expect(result.current.dirtyState.dirty).toBe(true);
      expect(useUiStore.getState().toastMessage?.message).toBe(t(toastKey));
    },
  );

  it("surfaces rejected credential saves, keeps drafts, and allows retry", async () => {
    setTauriRuntimePresent();
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

    await waitFor(() => expect(result.current.cloudflareAccessStatus).toBe("ready"));

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

    await act(async () => {
      await result.current.handleTestConnection();
    });

    expect(updateAccountCredentialsMock).toHaveBeenCalledTimes(2);
    expect(testAccountConnectionMock).toHaveBeenCalledTimes(1);
  });

  it("keeps the password draft and cached account unchanged when keyring update fails", async () => {
    const account = sampleAccounts[1];
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(queryKeys.accounts.root, [account]);
    updateAccountCredentialsMock.mockRejectedValue(new Error("keychain unavailable"));

    const { result } = renderHook(() =>
      useAccountDetailCredentialsEditor({
        account,
        queryClient,
        t,
      }),
    );

    act(() => {
      result.current.setCredPassword("new-secret");
    });

    let saved = true;
    await act(async () => {
      saved = await result.current.commitCredentials();
    });

    expect(saved).toBe(false);
    expect(updateAccountCredentialsMock).toHaveBeenCalledWith(
      account.id,
      account.server_url,
      account.username,
      "new-secret",
    );
    expect(queryClient.getQueryData(queryKeys.accounts.root)).toEqual([account]);
    expect(result.current.credPassword).toBe("new-secret");
    expect(result.current.passwordDisplayValue).toBe("new-secret");
    expect(useUiStore.getState().toastMessage?.message).toBe("Failed to update sync settings: keychain unavailable");
    expect(testAccountConnectionMock).not.toHaveBeenCalled();
  });

  it("records a successful save when the single connection verification fails", async () => {
    const account = sampleAccounts[1];
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(queryKeys.accounts.root, [account]);
    updateAccountCredentialsMock.mockResolvedValue(
      Result.succeed({
        ...account,
        username: "alice",
      }),
    );
    testAccountConnectionMock.mockResolvedValue(Result.fail({ message: "invalid credentials" }));

    const { result } = renderHook(() =>
      useAccountDetailCredentialsEditor({
        account,
        queryClient,
        t,
      }),
    );

    act(() => {
      result.current.setCredUsername("alice");
      result.current.setCredPassword("bad-secret");
    });

    await act(async () => {
      await result.current.handleTestConnection();
    });

    expect(updateAccountCredentialsMock).toHaveBeenCalledWith(account.id, account.server_url, "alice", "bad-secret");
    expect(testAccountConnectionMock).toHaveBeenCalledTimes(1);
    expect(testAccountConnectionMock).toHaveBeenCalledWith(account.id);
    expect(result.current.credUsername).toBeNull();
    expect(result.current.credPassword).toBeNull();
    expect(result.current.dirtyState.dirty).toBe(false);
    expect(useUiStore.getState().toastMessage?.message).toBe("Connection failed: invalid credentials");

    testAccountConnectionMock.mockResolvedValue(
      Result.succeed({
        ...account,
        username: "alice",
        connection_verification_status: "verified",
        connection_verified_at: "2026-04-19T05:32:00Z",
        connection_verification_error: null,
      }),
    );
    await act(async () => {
      await result.current.handleTestConnection();
    });

    expect(updateAccountCredentialsMock).toHaveBeenCalledTimes(1);
    expect(testAccountConnectionMock).toHaveBeenCalledTimes(2);
  });

  it("does not rewrite saved Access credentials when retrying a failed connection check", async () => {
    setTauriRuntimePresent();
    const account = sampleAccounts[1];
    getAccountCloudflareAccessMock.mockResolvedValue(Result.succeed({ client_id: "saved-client-id" }));
    updateAccountCredentialsMock.mockResolvedValue(Result.succeed(account));
    testAccountConnectionMock.mockResolvedValueOnce(Result.fail({ message: "invalid credentials" }));
    const { result } = renderHook(() =>
      useAccountDetailCredentialsEditor({ account, queryClient: createTestQueryClient(), t }),
    );
    await waitFor(() => expect(result.current.cloudflareAccessStatus).toBe("ready"));

    act(() => {
      result.current.setCloudflareAccessClientId("replacement-client-id");
      result.current.setCloudflareAccessSecret("replacement-dummy-secret");
    });
    await act(async () => {
      await result.current.handleTestConnection();
    });
    expect(updateAccountCredentialsMock).toHaveBeenCalledWith(
      account.id,
      account.server_url,
      account.username,
      undefined,
      {
        action: "replace",
        clientId: "replacement-client-id",
        clientSecret: "replacement-dummy-secret",
      },
    );
    expect(result.current.dirtyState.dirty).toBe(false);

    await act(async () => {
      await result.current.handleTestConnection();
    });
    expect(updateAccountCredentialsMock).toHaveBeenCalledTimes(1);
    expect(testAccountConnectionMock).toHaveBeenCalledTimes(2);
  });

  it("keeps connection verification single-flight", async () => {
    const account = sampleAccounts[1];
    const verification = createDeferred<ReturnType<typeof testAccountConnectionMock>>();
    testAccountConnectionMock.mockReturnValue(verification.promise);
    const { result } = renderHook(() =>
      useAccountDetailCredentialsEditor({ account, queryClient: createTestQueryClient(), t }),
    );

    let firstTest: Promise<void> = Promise.resolve();
    let secondTest: Promise<void> = Promise.resolve();
    act(() => {
      firstTest = result.current.handleTestConnection();
      secondTest = result.current.handleTestConnection();
    });
    await waitFor(() => expect(testAccountConnectionMock).toHaveBeenCalledTimes(1));

    await act(async () => {
      verification.resolve(
        Result.succeed({
          ...account,
          connection_verification_status: "verified",
          connection_verified_at: "2026-04-19T05:32:00Z",
          connection_verification_error: null,
        }),
      );
      await Promise.all([firstTest, secondTest]);
    });
    expect(testAccountConnectionMock).toHaveBeenCalledTimes(1);
    expect(updateAccountCredentialsMock).not.toHaveBeenCalled();
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

  it.each([
    {
      label: "Result failure",
      arrangeFailure: () => {
        testAccountConnectionMock.mockResolvedValue(Result.fail({ message: "test account not found" }));
      },
    },
    {
      label: "thrown error",
      arrangeFailure: () => {
        testAccountConnectionMock.mockRejectedValue(new Error("test account not found"));
      },
    },
  ])("surfaces connection test $label with the same failure feedback", async ({ arrangeFailure }) => {
    const account = sampleAccounts[1];
    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    arrangeFailure();

    const { result } = renderHook(() =>
      useAccountDetailCredentialsEditor({
        account,
        queryClient,
        t,
      }),
    );

    await act(async () => {
      await result.current.handleTestConnection();
    });

    expect(result.current.testingConnection).toBe(false);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.accounts.root });
    expect(useUiStore.getState().toastMessage?.message).toBe("Connection failed: test account not found");
  });

  it("ignores a stale connection success when the draft changes before the result returns", async () => {
    const account = sampleAccounts[1];
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(queryKeys.accounts.root, [account]);
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

    expect(queryClient.getQueryData(queryKeys.accounts.root)).toEqual([account]);
    expect(useUiStore.getState().toastMessage).toBeNull();
    expect(result.current.credUsername).toBe("new-draft");
    expect(result.current.testingConnection).toBe(false);
  });

  it("ignores a stale connection failure after switching accounts", async () => {
    const firstAccount = {
      ...sampleAccounts[1],
      id: "acc-1",
      name: "FreshRSS Work",
    };
    const secondAccount = {
      ...sampleAccounts[0],
      id: "acc-2",
      name: "Local Account",
    };
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

  it("records a persisted revision without testing or clearing a newer draft", async () => {
    const account = sampleAccounts[1];
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(queryKeys.accounts.root, [account]);
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
    const saveCredentials = result.current.handleTestConnection();

    act(() => {
      result.current.setCredUsername("current-draft");
    });

    await act(async () => {
      staleSave.resolve(Result.succeed({ ...account, username: "stale-user" }));
      await saveCredentials;
    });

    expect(queryClient.getQueryData(queryKeys.accounts.root)).toEqual([{ ...account, username: "stale-user" }]);
    expect(useUiStore.getState().toastMessage).toBeNull();
    expect(result.current.credUsername).toBe("current-draft");
    expect(testAccountConnectionMock).not.toHaveBeenCalled();
  });

  it("clears a saved password while keeping an unrelated newer edit", async () => {
    const account = sampleAccounts[1];
    const save = createDeferred<ReturnType<typeof updateAccountCredentialsMock>>();
    updateAccountCredentialsMock.mockReturnValue(save.promise);
    const { result } = renderHook(() =>
      useAccountDetailCredentialsEditor({ account, queryClient: createTestQueryClient(), t }),
    );

    act(() => result.current.setCredPassword("first-dummy-password"));
    const saving = result.current.commitCredentials();
    act(() => result.current.setCredUsername("newer-username"));

    await act(async () => {
      save.resolve(Result.succeed(account));
      await saving;
    });

    expect(result.current.credPassword).toBeNull();
    expect(result.current.credUsername).toBe("newer-username");
    expect(result.current.dirtyState.dirty).toBe(true);
    expect(testAccountConnectionMock).not.toHaveBeenCalled();
  });

  it("reuses an in-flight credential save for the same draft", async () => {
    const account = sampleAccounts[1];
    const pendingSave = createDeferred<ReturnType<typeof updateAccountCredentialsMock>>();
    updateAccountCredentialsMock.mockReturnValue(pendingSave.promise);

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

    const firstSave = result.current.commitCredentials();
    const secondSave = result.current.commitCredentials();

    expect(updateAccountCredentialsMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      pendingSave.resolve(Result.succeed({ ...account, username: "alice" }));
      await expect(firstSave).resolves.toBe(true);
      await expect(secondSave).resolves.toBe(true);
    });
  });

  it("queues a changed credential draft until the in-flight save settles", async () => {
    const account = sampleAccounts[1];
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(queryKeys.accounts.root, [account]);
    const firstSave = createDeferred<ReturnType<typeof updateAccountCredentialsMock>>();
    updateAccountCredentialsMock.mockReturnValueOnce(firstSave.promise).mockResolvedValueOnce(
      Result.succeed({
        ...account,
        username: "current-draft",
      }),
    );
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
    const staleSave = result.current.commitCredentials();

    act(() => {
      result.current.setCredUsername("current-draft");
    });
    const currentSave = result.current.commitCredentials();

    expect(updateAccountCredentialsMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      firstSave.resolve(Result.succeed({ ...account, username: "stale-user" }));
      await staleSave;
      await currentSave;
    });

    expect(updateAccountCredentialsMock).toHaveBeenCalledTimes(2);
    expect(updateAccountCredentialsMock).toHaveBeenLastCalledWith(
      account.id,
      account.server_url,
      "current-draft",
      undefined,
    );
    expect(queryClient.getQueryData(queryKeys.accounts.root)).toEqual([{ ...account, username: "current-draft" }]);
    expect(result.current.credUsername).toBeNull();
  });

  it("drops a queued credential draft when the account changes before the in-flight save settles", async () => {
    const firstAccount = {
      ...sampleAccounts[1],
      id: "acc-1",
      name: "FreshRSS Work",
    };
    const secondAccount = {
      ...sampleAccounts[1],
      id: "acc-2",
      name: "FreshRSS Personal",
    };
    const firstSave = createDeferred<ReturnType<typeof updateAccountCredentialsMock>>();
    updateAccountCredentialsMock.mockReturnValue(firstSave.promise);

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
      result.current.setCredUsername("stale-user");
    });
    const staleSave = result.current.commitCredentials();

    act(() => {
      result.current.setCredUsername("queued-user");
    });
    const queuedSave = result.current.commitCredentials();

    rerender({ account: secondAccount });

    await act(async () => {
      firstSave.resolve(Result.succeed({ ...firstAccount, username: "stale-user" }));
      await staleSave;
      await queuedSave;
    });

    expect(updateAccountCredentialsMock).toHaveBeenCalledTimes(1);
    expect(updateAccountCredentialsMock).toHaveBeenCalledWith(
      firstAccount.id,
      firstAccount.server_url,
      "stale-user",
      undefined,
    );
    expect(useUiStore.getState().toastMessage).toBeNull();
  });

  it("does not test a stale account after credential persistence finishes on a previous account", async () => {
    const firstAccount = {
      ...sampleAccounts[1],
      id: "acc-1",
      name: "FreshRSS Work",
    };
    const secondAccount = {
      ...sampleAccounts[1],
      id: "acc-2",
      name: "FreshRSS Personal",
    };
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

  it("does not invalidate cache or toast after credential persistence finishes on a closed detail", async () => {
    const account = sampleAccounts[1];
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(queryKeys.accounts.root, [account]);
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const staleSave = createDeferred<ReturnType<typeof updateAccountCredentialsMock>>();
    updateAccountCredentialsMock.mockReturnValue(staleSave.promise);

    const { result, unmount } = renderHook(() =>
      useAccountDetailCredentialsEditor({
        account,
        queryClient,
        t,
      }),
    );

    act(() => {
      result.current.setCredUsername("closed-detail-user");
    });
    const saveCredentials = result.current.commitCredentials();

    unmount();

    await act(async () => {
      staleSave.resolve(Result.succeed({ ...account, username: "closed-detail-user" }));
      await saveCredentials;
    });

    expect(queryClient.getQueryData(queryKeys.accounts.root)).toEqual([account]);
    expect(invalidateSpy).not.toHaveBeenCalled();
    expect(useUiStore.getState().toastMessage).toBeNull();
  });

  it("keeps credential save success visible when account invalidation rejects", async () => {
    const consoleWarn = suppressConsoleWarn();
    const account = sampleAccounts[1];
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(queryKeys.accounts.root, [account]);
    vi.spyOn(queryClient, "invalidateQueries").mockRejectedValue(new Error("refetch unavailable"));
    const updated = { ...account, username: "alice" };
    const verified = {
      ...updated,
      connection_verification_status: "verified" as const,
      connection_verified_at: "2026-04-19T05:32:00Z",
      connection_verification_error: null,
    };
    updateAccountCredentialsMock.mockResolvedValue(Result.succeed(updated));
    testAccountConnectionMock.mockResolvedValue(Result.succeed(verified));

    const { result } = renderHook(() =>
      useAccountDetailCredentialsEditor({
        account,
        queryClient,
        t,
      }),
    );

    act(() => {
      result.current.setCredUsername("alice");
    });

    let saved = false;
    await act(async () => {
      saved = await result.current.commitCredentials();
      await Promise.resolve();
    });

    expect(saved).toBe(true);
    expect(consoleWarn).toHaveBeenCalledWith(
      "Query invalidation failed:",
      expect.objectContaining({
        failures: [
          expect.objectContaining({
            actionOwner: "unknown",
            queryKey: queryKeys.accounts.root,
            error: expect.any(Error),
          }),
        ],
      }),
    );
    expect(queryClient.getQueryData(queryKeys.accounts.root)).toEqual([updated]);
    expect(useUiStore.getState().toastMessage?.message).toBe("Credentials saved");
  });

  it("does not restore focus from a stale account detail handler", () => {
    const firstAccount = {
      ...sampleAccounts[1],
      id: "acc-1",
      name: "FreshRSS Work",
    };
    const secondAccount = {
      ...sampleAccounts[1],
      id: "acc-2",
      name: "FreshRSS Personal",
    };
    const staleInput = document.createElement("input");
    const currentInput = document.createElement("input");
    document.body.append(staleInput, currentInput);

    const { result, rerender } = renderHook(
      ({ account }) =>
        useAccountDetailCredentialsEditor({
          account,
          queryClient: createTestQueryClient(),
          t,
        }),
      { initialProps: { account: firstAccount } },
    );

    const staleFocusCredentialsEditor = result.current.focusCredentialsEditor;
    setInputRef(result.current.serverUrlInputRef, staleInput);

    rerender({ account: secondAccount });
    setInputRef(result.current.serverUrlInputRef, currentInput);

    act(() => {
      staleFocusCredentialsEditor();
    });

    expect(staleInput).not.toHaveFocus();
    expect(currentInput).not.toHaveFocus();
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
