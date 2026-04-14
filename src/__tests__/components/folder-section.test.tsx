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
    reader_mode: "on",
    web_preview_mode: "off",
  },
  {
    id: "feed-2",
    account_id: "acc-1",
    folder_id: "folder-1",
    title: "Beta",
    url: "https://example.com/beta.xml",
    site_url: "https://example.com/beta",
    unread_count: 8,
    reader_mode: "on",
    web_preview_mode: "off",
  },
];

describe("FolderSectionView", () => {
  it("renders expansion state, aggregated unread count, and delegates folder/feed clicks", async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    const onSelectFeed = vi.fn();
    const { container } = render(
      <FolderSectionView
        folder={baseFolder}
        feeds={feeds}
        isExpanded={true}
        onToggle={onToggle}
        selectedFeedId="feed-2"
        onSelectFeed={onSelectFeed}
        displayFavicons={false}
      />,
    );

    const trigger = screen.getByRole("button", { name: /Work/i });
    const feedButton = screen.getByRole("button", { name: /Beta/i });

    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(trigger).toHaveClass("min-h-9");
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(feedButton).toHaveClass("bg-sidebar-accent");
    expect(feedButton).toHaveClass("min-h-9");
    expect(feedButton).not.toHaveAttribute("aria-haspopup");
    expect(container.querySelector('[data-slot="collapsible-content"]')).not.toBeNull();

    await user.click(trigger);
    await user.click(feedButton);

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
