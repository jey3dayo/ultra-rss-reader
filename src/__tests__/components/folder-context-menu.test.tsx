import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createQueryWrapper } from "@tests/helpers/create-wrapper";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FolderDto } from "@/api/tauri-commands";
import { FolderContextMenuContent } from "@/components/reader/folder-context-menu";
import { ContextMenu } from "@/design-system/context-menu";
import { useUiStore } from "@/stores/ui-store";

const markFolderReadMutate = vi.fn();
const confirmMarkAllReadMock = vi.fn();
const translations = new Map<string, string>([
  ["edit_ellipsis", "Edit…"],
  ["edit_folder", "Edit folder"],
  ["name", "Name"],
  ["mark_all_as_read", "Mark all as read"],
  ["mark_old_unread_read", "Mark old unread as read"],
  ["old_unread_older_than_days", "{{count}} days"],
]);

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  initReactI18next: {
    type: "3rdParty",
    init: () => undefined,
  },
  useTranslation: (namespace?: string) => ({
    t: (key: string, options?: { message?: string; name?: string; count?: number }) => {
      if (namespace === "sidebar") {
        const sidebarLabels: Record<string, string> = {
          folder_reset_order: "Reset folder order",
        };
        return sidebarLabels[key] ?? key;
      }
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

  const folder: FolderDto = {
    id: "folder-1",
    account_id: "acc-1",
    name: "Work",
    sort_order: 0,
  };

  it("opens a rename dialog with the current folder name from the context menu", async () => {
    const user = userEvent.setup();
    const { wrapper } = createQueryWrapper();
    render(
      <ContextMenu.Root open>
        <FolderContextMenuContent
          folder={folder}
          folderUnread={0}
          feeds={[]}
          folderOrderMode="name"
          onResetFolderOrder={vi.fn()}
        />
      </ContextMenu.Root>,
      { wrapper },
    );
    await user.click(screen.getByRole("menuitem", { name: "Edit…" }));
    expect(screen.getByRole("dialog", { name: "Edit folder" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Name" })).toHaveValue("Work");
  });

  it("confirms marking every folder feed as read", async () => {
    const user = userEvent.setup();

    render(
      <ContextMenu.Root open>
        <FolderContextMenuContent
          folder={folder}
          folderUnread={6}
          feeds={[]}
          folderOrderMode="name"
          onResetFolderOrder={vi.fn()}
        />
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
    render(
      <ContextMenu.Root open>
        <FolderContextMenuContent
          folder={folder}
          folderUnread={0}
          feeds={[]}
          folderOrderMode="manual"
          onResetFolderOrder={vi.fn()}
        />
      </ContextMenu.Root>,
    );

    expect(screen.queryByRole("menuitem", { name: "Mark all as read" })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: /move (up|down)/i })).not.toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Reset folder order" })).toBeInTheDocument();
  });
});
