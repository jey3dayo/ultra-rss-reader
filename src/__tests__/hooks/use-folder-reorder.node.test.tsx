import type { QueryClient } from "@tanstack/react-query";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { setupBrowserTestDom } from "@tests/helpers/browser-test-globals";
import { suppressConsoleError } from "@tests/helpers/console-spies";
import { createQueryWrapper } from "@tests/helpers/create-wrapper";
import { createDeferred } from "@tests/helpers/deferred";
import { setupTauriMocks, teardownTauriMocks } from "@tests/helpers/tauri-mocks";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AppError, FolderDto } from "@/api/tauri-commands";
import { useReorderFolders } from "@/hooks/use-folder-reorder";
import { queryKeys } from "@/lib/query/query-keys";
import type { ToastData } from "@/lib/ui/toast.types";
import { useUiStore } from "@/stores/ui-store";

setupBrowserTestDom();

const folders: FolderDto[] = [
  { id: "folder-a", account_id: "acc-1", name: "Alpha", sort_order: 0 },
  { id: "folder-b", account_id: "acc-1", name: "Bravo", sort_order: 1 },
  { id: "folder-c", account_id: "acc-1", name: "Charlie", sort_order: 2 },
];

describe("useReorderFolders", () => {
  let queryClient: QueryClient;
  let wrapper: ReturnType<typeof createQueryWrapper>["wrapper"];
  let showToastMock: ReturnType<typeof vi.fn<(message: string | ToastData) => void>>;

  beforeEach(() => {
    const queryWrapper = createQueryWrapper({
      queryClientConfig: { defaultOptions: { mutations: { retry: false } } },
    });
    queryClient = queryWrapper.queryClient;
    wrapper = queryWrapper.wrapper;
    showToastMock = vi.fn();
    useUiStore.setState(useUiStore.getInitialState());
    useUiStore.setState({ showToast: showToastMock });
  });

  afterEach(async () => {
    cleanup();
    await new Promise<void>((resolve) => setImmediate(resolve));
    teardownTauriMocks();
    vi.restoreAllMocks();
    useUiStore.setState(useUiStore.getInitialState());
  });

  it("shows the backend rejection and restores the cached folder order when saving fails", async () => {
    suppressConsoleError();
    const appError: AppError = { type: "UserVisible", message: "Folder list is out of date. Please retry." };
    setupTauriMocks((cmd) => {
      if (cmd === "reorder_folders") {
        throw appError;
      }
      return undefined;
    });
    const folderQueryKey = [...queryKeys.folders.root, "acc-1"];
    queryClient.setQueryData<FolderDto[]>(folderQueryKey, folders);

    const { result } = renderHook(() => useReorderFolders(), { wrapper });

    await expect(
      result.current.mutateAsync({ accountId: "acc-1", orderedFolderIds: ["folder-b", "folder-a"] }),
    ).rejects.toBeDefined();

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(showToastMock).toHaveBeenCalledWith(
      "Failed to save folder order: Folder list is out of date. Please retry.",
    );
    expect(queryClient.getQueryData<FolderDto[]>(folderQueryKey)).toEqual(folders);
  });

  it("does not restore an earlier unsaved order when queued reorders fail in a row", async () => {
    suppressConsoleError();
    const appError: AppError = { type: "UserVisible", message: "Folder list is out of date. Please retry." };
    const ipcCalls: ReturnType<typeof createDeferred<unknown>>[] = [];
    setupTauriMocks((cmd) => {
      if (cmd === "reorder_folders") {
        const call = createDeferred<unknown>();
        ipcCalls.push(call);
        return call.promise;
      }
      return undefined;
    });
    const folderQueryKey = [...queryKeys.folders.root, "acc-1"];
    const orderOf = () =>
      [...(queryClient.getQueryData<FolderDto[]>(folderQueryKey) ?? [])]
        .sort((left, right) => left.sort_order - right.sort_order)
        .map((folder) => folder.id);
    queryClient.setQueryData<FolderDto[]>(folderQueryKey, folders);
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useReorderFolders(), { wrapper });

    const first = result.current.mutateAsync({
      accountId: "acc-1",
      orderedFolderIds: ["folder-b", "folder-a", "folder-c"],
    });
    const firstOutcome = expect(first).rejects.toBeDefined();
    await waitFor(() => expect(orderOf()).toEqual(["folder-b", "folder-a", "folder-c"]));
    const second = result.current.mutateAsync({
      accountId: "acc-1",
      orderedFolderIds: ["folder-b", "folder-c", "folder-a"],
    });
    const secondOutcome = expect(second).rejects.toBeDefined();
    await waitFor(() => expect(orderOf()).toEqual(["folder-b", "folder-c", "folder-a"]));

    await waitFor(() => expect(ipcCalls).toHaveLength(1));
    ipcCalls[0].reject(appError);
    await firstOutcome;
    await waitFor(() => expect(ipcCalls).toHaveLength(2));
    ipcCalls[1].reject(appError);
    await secondOutcome;
    await waitFor(() => expect(result.current.isError).toBe(true));
    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    expect(orderOf()).toEqual(["folder-a", "folder-b", "folder-c"]);
    expect(showToastMock).toHaveBeenCalledTimes(2);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.folders.root });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.accounts.root });
  });

  it("keeps a later queued order on screen when an earlier save succeeds first", async () => {
    const ipcCalls: ReturnType<typeof createDeferred<FolderDto[]>>[] = [];
    setupTauriMocks((cmd) => {
      if (cmd === "reorder_folders") {
        const call = createDeferred<FolderDto[]>();
        ipcCalls.push(call);
        return call.promise;
      }
      return undefined;
    });
    const folderQueryKey = [...queryKeys.folders.root, "acc-1"];
    const orderOf = () =>
      [...(queryClient.getQueryData<FolderDto[]>(folderQueryKey) ?? [])]
        .sort((left, right) => left.sort_order - right.sort_order)
        .map((folder) => folder.id);
    const withOrder = (ids: string[]) =>
      ids.map((id, sortOrder) => ({
        ...(folders.find((folder) => folder.id === id) as FolderDto),
        sort_order: sortOrder,
      }));
    queryClient.setQueryData<FolderDto[]>(folderQueryKey, folders);

    const { result } = renderHook(() => useReorderFolders(), { wrapper });

    const first = result.current.mutateAsync({
      accountId: "acc-1",
      orderedFolderIds: ["folder-b", "folder-a", "folder-c"],
    });
    await waitFor(() => expect(orderOf()).toEqual(["folder-b", "folder-a", "folder-c"]));
    const second = result.current.mutateAsync({
      accountId: "acc-1",
      orderedFolderIds: ["folder-b", "folder-c", "folder-a"],
    });
    await waitFor(() => expect(orderOf()).toEqual(["folder-b", "folder-c", "folder-a"]));

    await waitFor(() => expect(ipcCalls).toHaveLength(1));
    ipcCalls[0].resolve(withOrder(["folder-b", "folder-a", "folder-c"]));
    await first;
    expect(orderOf()).toEqual(["folder-b", "folder-c", "folder-a"]);

    await waitFor(() => expect(ipcCalls).toHaveLength(2));
    ipcCalls[1].resolve(withOrder(["folder-b", "folder-c", "folder-a"]));
    await second;
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(orderOf()).toEqual(["folder-b", "folder-c", "folder-a"]);
  });
});
