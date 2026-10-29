import type { QueryClient } from "@tanstack/react-query";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { setupBrowserTestDom } from "@tests/helpers/browser-test-globals";
import { suppressConsoleError } from "@tests/helpers/console-spies";
import { createQueryWrapper } from "@tests/helpers/create-wrapper";
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
});
