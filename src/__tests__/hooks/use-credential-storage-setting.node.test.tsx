import { Result } from "@praha/byethrow";
import type { QueryClient } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { setupBrowserTestDom } from "@tests/helpers/browser-test-globals";
import { createQueryWrapper } from "@tests/helpers/create-wrapper";
import type { TFunction } from "i18next";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CredentialStorageDto } from "@/api/schemas";
import * as tauriCommands from "@/api/tauri-commands";
import { useCredentialStorageSetting } from "@/components/settings/hooks/use-credential-storage-setting";
import { accountSyncStatusQueryKey } from "@/hooks/use-account-sync-status";

setupBrowserTestDom();

const keychainDto: CredentialStorageDto = { storage: "os_keychain", configurable: true, cleanup_incomplete: false };
const localFileDto: CredentialStorageDto = { storage: "local_file", configurable: true, cleanup_incomplete: false };

function createT(): TFunction<"settings"> {
  return ((key: string, _values?: Record<string, unknown>) => key) as TFunction<"settings">;
}

type SetCredentialStorageResult = Awaited<ReturnType<typeof tauriCommands.setCredentialStorage>>;

function deferredSetCredentialStorageResult() {
  let resolve: (value: SetCredentialStorageResult) => void = () => undefined;
  const promise = new Promise<SetCredentialStorageResult>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe("useCredentialStorageSetting", () => {
  let queryClient: QueryClient;
  let wrapper: ReturnType<typeof createQueryWrapper>["wrapper"];
  let showToast: (message: string) => void;
  const queryClients = new Set<QueryClient>();

  function renderSettingHook() {
    queryClients.add(queryClient);
    return renderHook(() => useCredentialStorageSetting({ t: createT(), showToast }), { wrapper });
  }

  beforeEach(() => {
    const queryWrapper = createQueryWrapper();
    queryClient = queryWrapper.queryClient;
    wrapper = queryWrapper.wrapper;
    showToast = vi.fn();
    vi.restoreAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(async () => {
    await Promise.all([...queryClients].map((client) => client.cancelQueries()));
    for (const client of queryClients) {
      client.clear();
    }
    queryClients.clear();
    cleanup();
  });

  it("reports a load failure without toasting and keeps the setting unloaded", async () => {
    vi.spyOn(tauriCommands, "getCredentialStorage").mockResolvedValue(
      Result.fail({ type: "UserVisible", message: "keyring unavailable" }),
    );

    const { result } = renderSettingHook();

    await waitFor(() => {
      expect(result.current.loadErrorMessage).toBe("data.credential_storage_load_failed");
    });
    expect(result.current.loaded).toBe(false);
    expect(showToast).not.toHaveBeenCalled();
  });

  it("has no load error after the storage setting loads", async () => {
    vi.spyOn(tauriCommands, "getCredentialStorage").mockResolvedValue(Result.succeed(keychainDto));

    const { result } = renderSettingHook();

    await waitFor(() => {
      expect(result.current.loaded).toBe(true);
    });
    expect(result.current.loadErrorMessage).toBeNull();
  });

  it("invalidates the root account sync status query after a successful storage switch", async () => {
    const invalidateQueriesSpy = vi.spyOn(queryClient, "invalidateQueries");
    vi.spyOn(tauriCommands, "getCredentialStorage").mockResolvedValue(Result.succeed(keychainDto));
    const setCredentialStorageSpy = vi
      .spyOn(tauriCommands, "setCredentialStorage")
      .mockResolvedValue(Result.succeed(localFileDto));

    const { result } = renderSettingHook();

    await act(async () => {
      await result.current.handleChange("local_file");
    });

    expect(setCredentialStorageSpy).toHaveBeenCalledWith("local_file");
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: accountSyncStatusQueryKey() });
    expect(showToast).toHaveBeenCalledWith("data.credential_storage_saved");
    expect(result.current.storage).toBe("local_file");
    expect(result.current.saving).toBe(false);
    expect(result.current.errorMessage).toBeNull();
    expect(result.current.cleanupNotice).toBeNull();
  });

  it("shows the cleanup_incomplete toast and still invalidates account sync status when cleanup is incomplete", async () => {
    const invalidateQueriesSpy = vi.spyOn(queryClient, "invalidateQueries");
    vi.spyOn(tauriCommands, "getCredentialStorage").mockResolvedValue(Result.succeed(keychainDto));
    const setCredentialStorageSpy = vi
      .spyOn(tauriCommands, "setCredentialStorage")
      .mockResolvedValue(Result.succeed({ ...localFileDto, cleanup_incomplete: true }));

    const { result } = renderSettingHook();

    await act(async () => {
      await result.current.handleChange("local_file");
    });

    expect(setCredentialStorageSpy).toHaveBeenCalledWith("local_file");
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: accountSyncStatusQueryKey() });
    expect(showToast).toHaveBeenCalledWith("data.credential_storage_cleanup_incomplete");
    expect(showToast).not.toHaveBeenCalledWith("data.credential_storage_saved");
    expect(result.current.storage).toBe("local_file");
    expect(result.current.saving).toBe(false);
    expect(result.current.cleanupNotice).toBe("data.credential_storage_cleanup_incomplete");
    expect(result.current.errorMessage).toBeNull();
  });

  it("does not invalidate account sync status when the storage switch fails", async () => {
    const invalidateQueriesSpy = vi.spyOn(queryClient, "invalidateQueries");
    vi.spyOn(tauriCommands, "getCredentialStorage").mockResolvedValue(Result.succeed(keychainDto));
    const setCredentialStorageSpy = vi
      .spyOn(tauriCommands, "setCredentialStorage")
      .mockResolvedValue(Result.fail({ type: "UserVisible", message: "keyring unavailable" }));

    const { result } = renderSettingHook();

    await act(async () => {
      await result.current.handleChange("local_file");
    });

    expect(setCredentialStorageSpy).toHaveBeenCalledWith("local_file");
    expect(invalidateQueriesSpy).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith("data.credential_storage_failed");
    expect(result.current.saving).toBe(false);
    expect(result.current.errorMessage).toBe("data.credential_storage_failed");
    expect(result.current.cleanupNotice).toBeNull();
  });

  it("clears a previous failure as soon as the next storage change starts", async () => {
    vi.spyOn(tauriCommands, "getCredentialStorage").mockResolvedValue(Result.succeed(keychainDto));
    const retry = deferredSetCredentialStorageResult();
    vi.spyOn(tauriCommands, "setCredentialStorage")
      .mockResolvedValueOnce(Result.fail({ type: "UserVisible", message: "keyring unavailable" }))
      .mockReturnValueOnce(retry.promise);

    const { result } = renderSettingHook();

    await act(async () => {
      await result.current.handleChange("local_file");
    });
    expect(result.current.errorMessage).toBe("data.credential_storage_failed");

    let inFlight: Promise<void> = Promise.resolve();
    await act(async () => {
      inFlight = result.current.handleChange("local_file");
    });
    expect(result.current.saving).toBe(true);
    expect(result.current.errorMessage).toBeNull();

    await act(async () => {
      retry.resolve(Result.succeed(localFileDto));
      await inFlight;
    });
  });

  it("clears a previous cleanup notice as soon as the next storage change starts", async () => {
    vi.spyOn(tauriCommands, "getCredentialStorage").mockResolvedValue(Result.succeed(keychainDto));
    const next = deferredSetCredentialStorageResult();
    vi.spyOn(tauriCommands, "setCredentialStorage")
      .mockResolvedValueOnce(Result.succeed({ ...localFileDto, cleanup_incomplete: true }))
      .mockReturnValueOnce(next.promise);

    const { result } = renderSettingHook();

    await act(async () => {
      await result.current.handleChange("local_file");
    });
    expect(result.current.cleanupNotice).toBe("data.credential_storage_cleanup_incomplete");

    let inFlight: Promise<void> = Promise.resolve();
    await act(async () => {
      inFlight = result.current.handleChange("os_keychain");
    });
    expect(result.current.saving).toBe(true);
    expect(result.current.cleanupNotice).toBeNull();

    await act(async () => {
      next.resolve(Result.succeed(keychainDto));
      await inFlight;
    });
  });
});
