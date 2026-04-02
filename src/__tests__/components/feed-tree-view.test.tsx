import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { FeedTreeView } from "@/components/reader/feed-tree-view";

describe("FeedTreeView", () => {
  it("renders folder and feed rows and delegates row actions", async () => {
    const user = userEvent.setup();
    const onToggleFolder = vi.fn();
    const onSelectFeed = vi.fn();
    const renderFeedContextMenu = vi.fn(() => <div />);

    render(
      <FeedTreeView
        isOpen={true}
        folders={[
          {
            id: "folder-1",
            name: "Work",
            accountId: "acc-1",
            sortOrder: 0,
            unreadCount: 4,
            isExpanded: true,
            feeds: [
              {
                id: "feed-1",
                accountId: "acc-1",
                folderId: "folder-1",
                title: "Alpha",
                url: "https://example.com/alpha.xml",
                siteUrl: "https://example.com/alpha",
                unreadCount: 4,
                displayMode: "normal",
                isSelected: true,
                grayscaleFavicon: false,
              },
            ],
          },
        ]}
        unfolderedFeeds={[
          {
            id: "feed-2",
            accountId: "acc-1",
            folderId: null,
            title: "Beta",
            url: "https://example.com/beta.xml",
            siteUrl: "https://example.com/beta",
            unreadCount: 1,
            displayMode: "normal",
            isSelected: false,
            grayscaleFavicon: false,
          },
        ]}
        onToggleFolder={onToggleFolder}
        onSelectFeed={onSelectFeed}
        displayFavicons={false}
        emptyState={{ kind: "message", message: "No feeds yet" }}
        renderFolderContextMenu={() => <div />}
        renderFeedContextMenu={renderFeedContextMenu}
      />,
    );

    expect(screen.getByText("Work")).toBeInTheDocument();
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("Beta")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Work/ })).toHaveAttribute("aria-expanded", "true");

    await user.click(screen.getByRole("button", { name: /Work/ }));
    await user.click(screen.getByRole("button", { name: /Alpha/ }));
    await user.click(screen.getByRole("button", { name: /Beta/ }));

    expect(onToggleFolder).toHaveBeenCalledWith("folder-1");
    expect(onSelectFeed).toHaveBeenNthCalledWith(1, "feed-1");
    expect(onSelectFeed).toHaveBeenNthCalledWith(2, "feed-2");
    expect(renderFeedContextMenu).toHaveBeenCalledWith(expect.objectContaining({ id: "feed-1", folderId: "folder-1" }));
    expect(renderFeedContextMenu).toHaveBeenCalledWith(expect.objectContaining({ id: "feed-2", folderId: null }));
  });

  it("renders the empty action when there are no feeds", async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();

    render(
      <FeedTreeView
        isOpen={true}
        folders={[]}
        unfolderedFeeds={[]}
        onToggleFolder={vi.fn()}
        onSelectFeed={vi.fn()}
        displayFavicons={false}
        emptyState={{ kind: "action", label: "Add account", onAction }}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Add account" }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it("arms a feed from the handle and moves it to a folder target", () => {
    const onDragStartFeed = vi.fn();
    const onDropToFolder = vi.fn();

    render(
      <FeedTreeView
        isOpen={true}
        canDragFeeds={true}
        draggedFeedId="feed-2"
        activeDropTarget={null}
        folders={[
          {
            id: "folder-empty",
            name: "Empty",
            accountId: "acc-1",
            sortOrder: 1,
            unreadCount: 0,
            isExpanded: false,
            feeds: [],
          },
        ]}
        unfolderedFeeds={[
          {
            id: "feed-2",
            accountId: "acc-1",
            folderId: null,
            title: "Beta",
            url: "https://example.com/beta.xml",
            siteUrl: "https://example.com/beta",
            unreadCount: 1,
            displayMode: "normal",
            isSelected: false,
            grayscaleFavicon: false,
          },
        ]}
        onToggleFolder={vi.fn()}
        onSelectFeed={vi.fn()}
        onDragStartFeed={onDragStartFeed}
        onDragEnterFolder={vi.fn()}
        onDragEnterUnfoldered={vi.fn()}
        onDropToFolder={onDropToFolder}
        onDropToUnfoldered={vi.fn()}
        onDragEnd={vi.fn()}
        displayFavicons={false}
        emptyState={{ kind: "message", message: "No feeds yet" }}
      />,
    );

    const handle = screen.getByRole("button", { name: "Drag Beta" });
    const folderTarget = screen.getByRole("button", { name: "Move to Empty" });
    fireEvent.click(handle);
    fireEvent.click(folderTarget);

    expect(onDragStartFeed).toHaveBeenCalledWith(expect.objectContaining({ id: "feed-2" }));
    expect(onDropToFolder).toHaveBeenCalledWith("folder-empty");
  });

  it("accepts folder moves anywhere inside an expanded folder section", () => {
    const onDropToFolder = vi.fn();

    render(
      <FeedTreeView
        isOpen={true}
        canDragFeeds={true}
        draggedFeedId="feed-1"
        activeDropTarget={null}
        folders={[
          {
            id: "folder-source",
            name: "Source",
            accountId: "acc-1",
            sortOrder: 0,
            unreadCount: 0,
            isExpanded: true,
            feeds: [
              {
                id: "feed-1",
                accountId: "acc-1",
                folderId: "folder-source",
                title: "Alpha",
                url: "https://example.com/alpha.xml",
                siteUrl: "https://example.com/alpha",
                unreadCount: 0,
                displayMode: "normal",
                isSelected: false,
                grayscaleFavicon: false,
              },
            ],
          },
          {
            id: "folder-target",
            name: "Target",
            accountId: "acc-1",
            sortOrder: 1,
            unreadCount: 0,
            isExpanded: true,
            feeds: [
              {
                id: "feed-2",
                accountId: "acc-1",
                folderId: "folder-target",
                title: "Gamma",
                url: "https://example.com/gamma.xml",
                siteUrl: "https://example.com/gamma",
                unreadCount: 0,
                displayMode: "normal",
                isSelected: false,
                grayscaleFavicon: false,
              },
            ],
          },
        ]}
        unfolderedFeeds={[]}
        onToggleFolder={vi.fn()}
        onSelectFeed={vi.fn()}
        onDragStartFeed={vi.fn()}
        onDragEnterFolder={vi.fn()}
        onDragEnterUnfoldered={vi.fn()}
        onDropToFolder={onDropToFolder}
        onDropToUnfoldered={vi.fn()}
        onDragEnd={vi.fn()}
        displayFavicons={false}
        emptyState={{ kind: "message", message: "No feeds yet" }}
      />,
    );

    const handle = screen.getByRole("button", { name: "Drag Alpha" });
    const targetFeed = screen.getByRole("button", { name: "Move to Target" });
    fireEvent.click(handle);
    fireEvent.click(targetFeed);

    expect(onDropToFolder).toHaveBeenCalledWith("folder-target");
  });

  it("moves a feed with pointer drag onto a folder section", () => {
    const onDragStartFeed = vi.fn();
    const onDragEnterFolder = vi.fn();
    const onDropToFolder = vi.fn();

    render(
      <FeedTreeView
        isOpen={true}
        canDragFeeds={true}
        folders={[
          {
            id: "folder-target",
            name: "Target",
            accountId: "acc-1",
            sortOrder: 0,
            unreadCount: 0,
            isExpanded: false,
            feeds: [],
          },
        ]}
        unfolderedFeeds={[
          {
            id: "feed-1",
            accountId: "acc-1",
            folderId: null,
            title: "Alpha",
            url: "https://example.com/alpha.xml",
            siteUrl: "https://example.com/alpha",
            unreadCount: 0,
            displayMode: "normal",
            isSelected: false,
            grayscaleFavicon: false,
          },
        ]}
        onToggleFolder={vi.fn()}
        onSelectFeed={vi.fn()}
        onDragStartFeed={onDragStartFeed}
        onDragEnterFolder={onDragEnterFolder}
        onDragEnterUnfoldered={vi.fn()}
        onDropToFolder={onDropToFolder}
        onDropToUnfoldered={vi.fn()}
        onDragEnd={vi.fn()}
        displayFavicons={false}
        emptyState={{ kind: "message", message: "No feeds yet" }}
      />,
    );

    const targetButton = screen.getByRole("button", { name: "Move to Target" });
    const originalElementFromPoint = document.elementFromPoint;
    Object.defineProperty(document, "elementFromPoint", {
      configurable: true,
      value: vi.fn(() => targetButton),
    });

    fireEvent.pointerDown(screen.getByRole("button", { name: "Drag Alpha" }), {
      button: 0,
      clientX: 10,
      clientY: 10,
      pointerId: 1,
    });
    fireEvent.pointerMove(window, {
      clientX: 28,
      clientY: 28,
      pointerId: 1,
    });
    fireEvent.pointerUp(window, {
      clientX: 28,
      clientY: 28,
      pointerId: 1,
    });

    expect(onDragStartFeed).toHaveBeenCalledWith(expect.objectContaining({ id: "feed-1" }));
    expect(onDragEnterFolder).toHaveBeenCalledWith("folder-target");
    expect(onDropToFolder).toHaveBeenCalledWith("folder-target");

    Object.defineProperty(document, "elementFromPoint", {
      configurable: true,
      value: originalElementFromPoint,
    });
  });

  it("allows moving a feed by clicking the handle and then the target folder", () => {
    const onDragStartFeed = vi.fn();
    const onDropToFolder = vi.fn();

    render(
      <FeedTreeView
        isOpen={true}
        canDragFeeds={true}
        draggedFeedId="feed-1"
        activeDropTarget={{ kind: "folder", folderId: "folder-target" }}
        folders={[
          {
            id: "folder-target",
            name: "Target",
            accountId: "acc-1",
            sortOrder: 0,
            unreadCount: 0,
            isExpanded: false,
            feeds: [],
          },
        ]}
        unfolderedFeeds={[
          {
            id: "feed-1",
            accountId: "acc-1",
            folderId: null,
            title: "Alpha",
            url: "https://example.com/alpha.xml",
            siteUrl: "https://example.com/alpha",
            unreadCount: 0,
            displayMode: "normal",
            isSelected: false,
            grayscaleFavicon: false,
          },
        ]}
        onToggleFolder={vi.fn()}
        onSelectFeed={vi.fn()}
        onDragStartFeed={onDragStartFeed}
        onDragEnterFolder={vi.fn()}
        onDragEnterUnfoldered={vi.fn()}
        onDropToFolder={onDropToFolder}
        onDropToUnfoldered={vi.fn()}
        onDragEnd={vi.fn()}
        displayFavicons={false}
        emptyState={{ kind: "message", message: "No feeds yet" }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Drag Alpha" }));
    fireEvent.click(screen.getByRole("button", { name: "Move to Target" }));

    expect(onDragStartFeed).toHaveBeenCalledWith(expect.objectContaining({ id: "feed-1" }));
    expect(onDropToFolder).toHaveBeenCalledWith("folder-target");
  });

  it("renders the unfoldered drop zone highlight when active", () => {
    render(
      <FeedTreeView
        isOpen={true}
        canDragFeeds={true}
        draggedFeedId="feed-1"
        activeDropTarget={{ kind: "unfoldered" }}
        folders={[
          {
            id: "folder-1",
            name: "Work",
            accountId: "acc-1",
            sortOrder: 0,
            unreadCount: 0,
            isExpanded: false,
            feeds: [],
          },
        ]}
        unfolderedFeeds={[
          {
            id: "feed-1",
            accountId: "acc-1",
            folderId: null,
            title: "Alpha",
            url: "https://example.com/alpha.xml",
            siteUrl: "https://example.com/alpha",
            unreadCount: 1,
            displayMode: "normal",
            isSelected: false,
            grayscaleFavicon: false,
          },
        ]}
        onToggleFolder={vi.fn()}
        onSelectFeed={vi.fn()}
        onDragStartFeed={vi.fn()}
        onDragEnterFolder={vi.fn()}
        onDragEnterUnfoldered={vi.fn()}
        onDropToFolder={vi.fn()}
        onDropToUnfoldered={vi.fn()}
        onDragEnd={vi.fn()}
        displayFavicons={false}
        emptyState={{ kind: "message", message: "No feeds yet" }}
      />,
    );

    expect(screen.getByTestId("unfoldered-drop-zone")).toHaveClass("bg-sidebar-accent/60");
  });

  it("hides the unfoldered drop zone when dragging is disabled", () => {
    render(
      <FeedTreeView
        isOpen={true}
        canDragFeeds={false}
        draggedFeedId={null}
        activeDropTarget={null}
        folders={[
          {
            id: "folder-1",
            name: "Work",
            accountId: "acc-1",
            sortOrder: 0,
            unreadCount: 0,
            isExpanded: false,
            feeds: [],
          },
        ]}
        unfolderedFeeds={[
          {
            id: "feed-1",
            accountId: "acc-1",
            folderId: null,
            title: "Alpha",
            url: "https://example.com/alpha.xml",
            siteUrl: "https://example.com/alpha",
            unreadCount: 1,
            displayMode: "normal",
            isSelected: false,
            grayscaleFavicon: false,
          },
        ]}
        onToggleFolder={vi.fn()}
        onSelectFeed={vi.fn()}
        onDragStartFeed={vi.fn()}
        onDragEnterFolder={vi.fn()}
        onDragEnterUnfoldered={vi.fn()}
        onDropToFolder={vi.fn()}
        onDropToUnfoldered={vi.fn()}
        onDragEnd={vi.fn()}
        displayFavicons={false}
        emptyState={{ kind: "message", message: "No feeds yet" }}
      />,
    );

    expect(screen.queryByTestId("unfoldered-drop-zone")).not.toBeInTheDocument();
  });
});
