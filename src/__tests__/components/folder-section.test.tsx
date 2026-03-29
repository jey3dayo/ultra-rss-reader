import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { FeedDto, FolderDto } from "@/api/tauri-commands";
import { FolderSectionView } from "@/components/reader/folder-section";

const baseFolder: FolderDto = {
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
    unread_count: 4,
    display_mode: "normal",
  },
  {
    id: "feed-2",
    account_id: "acc-1",
    folder_id: "folder-1",
    title: "Beta",
    url: "https://example.com/beta.xml",
    site_url: "https://example.com/beta",
    unread_count: 8,
    display_mode: "normal",
  },
];

describe("FolderSectionView", () => {
  it("renders expansion state, aggregated unread count, and delegates folder/feed clicks", async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    const onSelectFeed = vi.fn();

    render(
      <FolderSectionView
        folder={baseFolder}
        feeds={feeds}
        isExpanded={true}
        onToggle={onToggle}
        selectedFeedId="feed-2"
        onSelectFeed={onSelectFeed}
        displayFavicons={false}
        hasContextMenu={true}
      />,
    );

    const trigger = screen.getByRole("button", { name: /Work/i });

    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(trigger).toHaveAttribute("aria-haspopup", "menu");
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Beta/i })).toHaveClass("bg-sidebar-accent");

    await user.click(trigger);
    await user.click(screen.getByRole("button", { name: /Beta/i }));

    expect(onToggle).toHaveBeenCalledWith("folder-1");
    expect(onSelectFeed).toHaveBeenCalledWith("feed-2");
  });

  it("hides child feeds when collapsed", () => {
    render(
      <FolderSectionView
        folder={baseFolder}
        feeds={feeds}
        isExpanded={false}
        onToggle={vi.fn()}
        selectedFeedId={null}
        onSelectFeed={vi.fn()}
        displayFavicons={false}
      />,
    );

    expect(screen.getByRole("button", { name: /Work/i })).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("button", { name: /Alpha/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Beta/i })).not.toBeInTheDocument();
  });
});
