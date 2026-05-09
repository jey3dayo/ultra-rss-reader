import { Result } from "@praha/byethrow";
import { act, renderHook } from "@testing-library/react";
import { createTestQueryClient } from "@tests/helpers/create-wrapper";
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
});

function setInputRef(ref: RefObject<HTMLInputElement | null>, input: HTMLInputElement): void {
  Object.defineProperty(ref, "current", {
    configurable: true,
    value: input,
  });
}
