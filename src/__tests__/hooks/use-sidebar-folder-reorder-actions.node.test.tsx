import { act, cleanup, renderHook } from "@testing-library/react";
import { setupBrowserTestDom } from "@tests/helpers/browser-test-globals";
import { createQueryWrapper } from "@tests/helpers/create-wrapper";
import { setupTauriMocks, teardownTauriMocks } from "@tests/helpers/tauri-mocks";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FolderDto } from "@/api/tauri-commands";
import { useSidebarFolderReorderActions } from "@/components/reader/hooks/sidebar/use-sidebar-folder-reorder-actions";
import { useUiStore } from "@/stores/ui-store";

setupBrowserTestDom();

const folders: FolderDto[] = [
  { id: "folder-a", account_id: "acc-1", name: "Alpha", sort_order: 0 },
  { id: "folder-b", account_id: "acc-1", name: "Bravo", sort_order: 1 },
];

describe("useSidebarFolderReorderActions reset confirmation", () => {
  const showConfirm = vi.fn();

  beforeEach(() => {
    setupTauriMocks(() => undefined);
    showConfirm.mockClear();
    useUiStore.setState(useUiStore.getInitialState());
    useUiStore.setState({ showConfirm });
  });

  afterEach(() => {
    cleanup();
    teardownTauriMocks();
  });

  it("asks for confirmation with the shared warning dialog variant in manual mode", () => {
    const { wrapper } = createQueryWrapper();
    const { result } = renderHook(
      () =>
        useSidebarFolderReorderActions({
          accountId: "acc-1",
          folderOrderMode: "manual",
          folders,
          visibleOrderedFolderIds: ["folder-a", "folder-b"],
        }),
      { wrapper },
    );

    act(() => result.current.resetFolderOrder());

    expect(showConfirm).toHaveBeenCalledWith(expect.any(String), expect.any(Function), {
      actionLabel: expect.any(String),
      variant: "warning",
    });
  });
});

describe("useSidebarFolderReorderActions live region", () => {
  beforeEach(() => {
    setupTauriMocks((cmd) => (cmd === "reorder_folders" ? folders : undefined));
    useUiStore.setState(useUiStore.getInitialState());
  });

  afterEach(() => {
    cleanup();
    teardownTauriMocks();
  });

  it("clears the announcement before a repeated move so the same text is announced again", async () => {
    const { wrapper } = createQueryWrapper();
    const { result } = renderHook(
      () =>
        useSidebarFolderReorderActions({
          accountId: "acc-1",
          folderOrderMode: "manual",
          folders,
          visibleOrderedFolderIds: ["folder-a", "folder-b"],
        }),
      { wrapper },
    );

    await act(async () => {
      result.current.moveFolderByDirection("folder-b", "up");
    });
    await vi.waitFor(() => expect(result.current.liveRegionMessage).toBe("Bravo moved up"));

    act(() => {
      result.current.moveFolderByDirection("folder-b", "up");
    });

    expect(result.current.liveRegionMessage).toBeNull();
    await vi.waitFor(() => expect(result.current.liveRegionMessage).toBe("Bravo moved up"));
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  });
});
