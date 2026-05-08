import { ContextMenu } from "@base-ui/react/context-menu";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { FeedDto, FolderDto } from "@/api/tauri-commands";
import { FolderContextMenuContent } from "@/components/reader/folder-context-menu";

const markFolderReadMutate = vi.fn();
const updateFeedDisplaySettingsMock = vi.fn();
const confirmMarkAllReadMock = vi.fn();
const translations = new Map<string, string>([
  ["mark_all_as_read", "Mark all as read"],
  ["mark_old_unread_read", "Mark old unread as read"],
  ["old_unread_older_than_days", "{{count}} days"],
  ["display_mode", "Display mode"],
  ["display_mode_default", "Default"],
  ["display_mode_standard", "Standard"],
  ["display_mode_preview", "Preview"],
]);

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => translations.get(key) ?? key,
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

vi.mock("@/hooks/use-update-feed-display-mode", () => ({
  useUpdateFeedDisplaySettings: () => updateFeedDisplaySettingsMock,
}));

describe("FolderContextMenuContent", () => {
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
      onConfirm: expect.any(Function),
    });
    confirmMarkAllReadMock.mock.calls[0]?.[0].onConfirm();
    expect(markFolderReadMutate).toHaveBeenCalledWith("folder-1");
  });

  it("applies the selected display preset to every feed in the folder", async () => {
    const user = userEvent.setup();
    const folder: FolderDto = {
      id: "folder-1",
      account_id: "acc-1",
      name: "Work",
      sort_order: 0,
    };
    const feeds: FeedDto[] = [
      {
        id: "feed-1",
        account_id: "acc-1",
        folder_id: "folder-1",
        title: "Alpha",
        url: "https://example.com/alpha.xml",
        site_url: "https://example.com/alpha",
        unread_count: 2,
        reader_mode: "inherit",
        web_preview_mode: "inherit",
      },
      {
        id: "feed-2",
        account_id: "acc-1",
        folder_id: "folder-1",
        title: "Beta",
        url: "https://example.com/beta.xml",
        site_url: "https://example.com/beta",
        unread_count: 4,
        reader_mode: "on",
        web_preview_mode: "off",
      },
    ];

    updateFeedDisplaySettingsMock.mockResolvedValue(true);

    render(
      <ContextMenu.Root open>
        <FolderContextMenuContent folder={folder} folderUnread={6} feeds={feeds} />
      </ContextMenu.Root>,
    );

    await user.click(screen.getByRole("menuitem", { name: "Preview" }));

    await waitFor(() => {
      expect(updateFeedDisplaySettingsMock).toHaveBeenNthCalledWith(1, "feed-1", "on", "on");
      expect(updateFeedDisplaySettingsMock).toHaveBeenNthCalledWith(2, "feed-2", "on", "on");
    });
  });

  it("shows mixed selection when folder feeds do not share the same display preset", () => {
    const folder: FolderDto = {
      id: "folder-1",
      account_id: "acc-1",
      name: "Work",
      sort_order: 0,
    };
    const feeds: FeedDto[] = [
      {
        id: "feed-1",
        account_id: "acc-1",
        folder_id: "folder-1",
        title: "Alpha",
        url: "https://example.com/alpha.xml",
        site_url: "https://example.com/alpha",
        unread_count: 2,
        reader_mode: "inherit",
        web_preview_mode: "inherit",
      },
      {
        id: "feed-2",
        account_id: "acc-1",
        folder_id: "folder-1",
        title: "Beta",
        url: "https://example.com/beta.xml",
        site_url: "https://example.com/beta",
        unread_count: 4,
        reader_mode: "on",
        web_preview_mode: "off",
      },
    ];

    render(
      <ContextMenu.Root open>
        <FolderContextMenuContent folder={folder} folderUnread={6} feeds={feeds} />
      </ContextMenu.Root>,
    );

    expect(screen.getByRole("menuitem", { name: "Default" })).not.toHaveTextContent("✓");
    expect(screen.getByRole("menuitem", { name: "Standard" })).not.toHaveTextContent("✓");
    expect(screen.getByRole("menuitem", { name: "Preview" })).not.toHaveTextContent("✓");
  });
});
