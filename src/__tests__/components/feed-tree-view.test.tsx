import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { FeedDto, FolderDto } from "@/api/tauri-commands";
import { FeedTreeView } from "@/components/reader/feed-tree-view";

vi.mock("@/components/reader/folder-section", () => ({
  FolderSection: ({
    folder,
    feeds,
    isExpanded,
    onToggle,
  }: {
    folder: FolderDto;
    feeds: FeedDto[];
    isExpanded: boolean;
    onToggle: (folderId: string) => void;
  }) => (
    <section>
      <button type="button" onClick={() => onToggle(folder.id)}>
        {folder.name}
      </button>
      <span>{isExpanded ? "expanded" : "collapsed"}</span>
      {feeds.map((feed) => (
        <div key={feed.id}>{feed.title}</div>
      ))}
    </section>
  ),
}));

vi.mock("@/components/reader/feed-item", () => ({
  FeedItem: ({ feed, onSelect }: { feed: FeedDto; onSelect: (feedId: string) => void }) => (
    <button type="button" onClick={() => onSelect(feed.id)}>
      {feed.title}
    </button>
  ),
}));

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
    unread_count: 4,
    display_mode: "normal",
  },
  {
    id: "feed-2",
    account_id: "acc-1",
    folder_id: null,
    title: "Beta",
    url: "https://example.com/beta.xml",
    site_url: "https://example.com/beta",
    unread_count: 1,
    display_mode: "normal",
  },
];

describe("FeedTreeView", () => {
  it("renders folder and feed rows and toggles the section", async () => {
    const user = userEvent.setup();
    const onToggleOpen = vi.fn();
    const onToggleFolder = vi.fn();
    const onSelectFeed = vi.fn();

    render(
      <FeedTreeView
        feedsLabel="Feeds"
        isOpen={true}
        onToggleOpen={onToggleOpen}
        folders={[
          {
            folder,
            feeds: [feeds[0]],
            isExpanded: true,
          },
        ]}
        unfolderedFeeds={[feeds[1]]}
        selectedFeedId="feed-1"
        onToggleFolder={onToggleFolder}
        onSelectFeed={onSelectFeed}
        displayFavicons={false}
        emptyState={<p>No feeds yet</p>}
      />,
    );

    expect(screen.getByRole("button", { name: "Feeds" })).toBeInTheDocument();
    expect(screen.getByText("Work")).toBeInTheDocument();
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("Beta")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Feeds" }));
    expect(onToggleOpen).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "Work" }));
    expect(onToggleFolder).toHaveBeenCalledWith("folder-1");
  });

  it("renders the empty state when there are no feeds", () => {
    render(
      <FeedTreeView
        feedsLabel="Feeds"
        isOpen={true}
        onToggleOpen={vi.fn()}
        folders={[]}
        unfolderedFeeds={[]}
        selectedFeedId={null}
        onToggleFolder={vi.fn()}
        onSelectFeed={vi.fn()}
        displayFavicons={false}
        emptyState={<p>No feeds yet</p>}
      />,
    );

    expect(screen.getByText("No feeds yet")).toBeInTheDocument();
  });
});
