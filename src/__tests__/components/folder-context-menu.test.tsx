import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FolderDto } from "@/api/tauri-commands";
import { FolderContextMenuContent } from "@/components/reader/folder-context-menu";
import { ContextMenu } from "@/design-system/context-menu";
import { useUiStore } from "@/stores/ui-store";

const markFolderReadMutate = vi.fn();
const confirmMarkAllReadMock = vi.fn();
const translations = new Map<string, string>([
  ["mark_all_as_read", "Mark all as read"],
  ["mark_old_unread_read", "Mark old unread as read"],
  ["old_unread_older_than_days", "{{count}} days"],
]);

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { message?: string }) => {
      const translated = translations.get(key) ?? key;
      return options?.message ? `${translated}:${options.message}` : translated;
    },
  }),
}));

vi.mock("@/hooks/use-articles", () => ({
  useMarkFolderRead: () => ({
    mutate: markFolderReadMutate,
  }),
  useMarkOldUnreadRead: () => ({
    mutate: vi.fn(),
  }),
}));

vi.mock("@/hooks/use-confirm-mark-all-read", () => ({
  useConfirmMarkAllRead: () => confirmMarkAllReadMock,
}));

describe("FolderContextMenuContent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useUiStore.setState(useUiStore.getInitialState());
  });

  it("confirms marking every folder feed as read", async () => {
    const user = userEvent.setup();
    const folder: FolderDto = {
      id: "folder-1",
      account_id: "acc-1",
      name: "Work",
      sort_order: 0,
    };

    render(
      <ContextMenu.Root open>
        <FolderContextMenuContent folder={folder} folderUnread={6} feeds={[]} />
      </ContextMenu.Root>,
    );

    await user.click(screen.getByRole("menuitem", { name: "Mark all as read" }));

    expect(confirmMarkAllReadMock).toHaveBeenCalledWith({
      count: 6,
      scope: "folder",
      onConfirm: expect.any(Function),
    });
    confirmMarkAllReadMock.mock.calls[0]?.[0].onConfirm();
    expect(markFolderReadMutate).toHaveBeenCalledWith("folder-1");
  });

  it("hides mark all read when folder unread count is zero", () => {
    const folder: FolderDto = {
      id: "folder-1",
      account_id: "acc-1",
      name: "Work",
      sort_order: 0,
    };

    render(
      <ContextMenu.Root open>
        <FolderContextMenuContent folder={folder} folderUnread={0} feeds={[]} />
      </ContextMenu.Root>,
    );

    expect(screen.queryByRole("menuitem", { name: "Mark all as read" })).not.toBeInTheDocument();
    expect(confirmMarkAllReadMock).not.toHaveBeenCalled();
  });
});
