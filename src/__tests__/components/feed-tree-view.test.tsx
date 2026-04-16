import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FeedTreeView } from "@/components/reader/feed-tree-view";
import i18n from "@/lib/i18n";

describe("FeedTreeView", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
  });

  it("renders folder and feed rows and delegates row actions", async () => {
    const user = userEvent.setup();
    const onToggleFolder = vi.fn();
    const onSelectFeed = vi.fn();
    const renderFeedContextMenu = vi.fn(() => <div />);

    render(
      <FeedTreeView
        isOpen={true}
        unfolderedLabel="No folder"
        folders={[
          {
            id: "folder-1",
            name: "Work",
            accountId: "acc-1",
            sortOrder: 0,
            unreadCount: 4,
            isExpanded: true,
            isSelected: false,
            feeds: [
              {
                id: "feed-1",
                accountId: "acc-1",
                folderId: "folder-1",
                title: "Alpha",
                url: "https://example.com/alpha.xml",
                siteUrl: "https://example.com/alpha",
                unreadCount: 4,
                readerMode: "on",
                webPreviewMode: "off",
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
            readerMode: "on",
            webPreviewMode: "off",
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
    expect(screen.getByText("No folder")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Toggle folder Work" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: "Toggle folder Work" })).toHaveClass("h-7");
    expect(screen.getByRole("button", { name: "Toggle folder Work" })).toHaveClass("w-7");
    expect(screen.getByRole("button", { name: "Select folder Work" })).toHaveClass("min-h-9");
    expect(screen.getByRole("button", { name: /Alpha/ })).toHaveClass("min-h-9");
    expect(screen.getByRole("button", { name: /Beta/ })).toHaveClass("min-h-9");

    await user.click(screen.getByRole("button", { name: "Toggle folder Work" }));
    await user.click(screen.getByRole("button", { name: /Alpha/ }));
    await user.click(screen.getByRole("button", { name: /Beta/ }));

    expect(onToggleFolder).toHaveBeenCalledWith("folder-1");
    expect(onSelectFeed).toHaveBeenNthCalledWith(1, "feed-1");
    expect(onSelectFeed).toHaveBeenNthCalledWith(2, "feed-2");
    expect(renderFeedContextMenu).toHaveBeenCalledWith(expect.objectContaining({ id: "feed-1", folderId: "folder-1" }));
    expect(renderFeedContextMenu).toHaveBeenCalledWith(expect.objectContaining({ id: "feed-2", folderId: null }));
  });

  it("renders nested feeds only for expanded folders", () => {
    render(
      <FeedTreeView
        isOpen={true}
        folders={[
          {
            id: "folder-expanded",
            name: "Expanded",
            accountId: "acc-1",
            sortOrder: 0,
            unreadCount: 3,
            isExpanded: true,
            isSelected: false,
            feeds: [
              {
                id: "feed-1",
                accountId: "acc-1",
                folderId: "folder-expanded",
                title: "Alpha",
                url: "https://example.com/alpha.xml",
                siteUrl: "https://example.com/alpha",
                unreadCount: 2,
                readerMode: "on",
                webPreviewMode: "off",
                isSelected: false,
                grayscaleFavicon: false,
              },
              {
                id: "feed-2",
                accountId: "acc-1",
                folderId: "folder-expanded",
                title: "Beta",
                url: "https://example.com/beta.xml",
                siteUrl: "https://example.com/beta",
                unreadCount: 1,
                readerMode: "on",
                webPreviewMode: "off",
                isSelected: true,
                grayscaleFavicon: false,
              },
            ],
          },
          {
            id: "folder-collapsed",
            name: "Collapsed",
            accountId: "acc-1",
            sortOrder: 1,
            unreadCount: 1,
            isExpanded: false,
            isSelected: false,
            feeds: [
              {
                id: "feed-3",
                accountId: "acc-1",
                folderId: "folder-collapsed",
                title: "Gamma",
                url: "https://example.com/gamma.xml",
                siteUrl: "https://example.com/gamma",
                unreadCount: 1,
                readerMode: "on",
                webPreviewMode: "off",
                isSelected: false,
                grayscaleFavicon: false,
              },
            ],
          },
        ]}
        unfolderedFeeds={[]}
        onToggleFolder={vi.fn()}
        onSelectFeed={vi.fn()}
        displayFavicons={false}
        emptyState={{ kind: "message", message: "No feeds yet" }}
      />,
    );

    expect(screen.getByRole("button", { name: /Alpha/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Beta/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Gamma/ })).not.toBeInTheDocument();
  });

  it("separates folder selection from folder expansion", async () => {
    const user = userEvent.setup();
    const onToggleFolder = vi.fn();
    const onSelectFolder = vi.fn();

    render(
      <FeedTreeView
        isOpen={true}
        folders={[
          {
            id: "folder-1",
            name: "Work",
            accountId: "acc-1",
            sortOrder: 0,
            unreadCount: 2,
            isExpanded: false,
            isSelected: false,
            feeds: [],
          },
        ]}
        unfolderedFeeds={[]}
        onToggleFolder={onToggleFolder}
        onSelectFolder={onSelectFolder}
        onSelectFeed={vi.fn()}
        displayFavicons={false}
        emptyState={{ kind: "message", message: "No feeds yet" }}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Select folder Work" }));
    await user.click(screen.getByRole("button", { name: "Toggle folder Work" }));

    expect(onSelectFolder).toHaveBeenCalledWith("folder-1");
    expect(onToggleFolder).toHaveBeenCalledWith("folder-1");
  });

  it("renders selected folder indicator aligned from the row edge and hides the button marker", () => {
    const { container } = render(
      <FeedTreeView
        isOpen={true}
        folders={[
          {
            id: "folder-1",
            name: "Work",
            accountId: "acc-1",
            sortOrder: 0,
            unreadCount: 2,
            isExpanded: false,
            isSelected: true,
            feeds: [],
          },
        ]}
        unfolderedFeeds={[]}
        onToggleFolder={vi.fn()}
        onSelectFolder={vi.fn()}
        onSelectFeed={vi.fn()}
        displayFavicons={false}
        emptyState={{ kind: "message", message: "No feeds yet" }}
      />,
    );

    const folderButton = screen.getByRole("button", { name: "Select folder Work" });
    const selectedIndicator = container.querySelector<HTMLElement>("[data-folder-row-selected-indicator='folder-1']");

    expect(selectedIndicator).not.toBeNull();
    expect(selectedIndicator).toHaveClass("left-0");
    expect(folderButton).not.toHaveClass("before:bg-primary/85");
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

    const actionButton = screen.getByRole("button", { name: "Add account" });
    expect(actionButton).toHaveClass("min-h-11");
    await user.click(actionButton);
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
            isSelected: false,
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
            readerMode: "on",
            webPreviewMode: "off",
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
    const feedButton = document.querySelector('[data-feed-id="feed-2"]');
    expect(handle).toHaveClass("h-7");
    expect(handle).toHaveClass("w-7");
    expect(handle).toHaveClass("group-hover/feed-row:opacity-100");
    expect(feedButton).not.toBeNull();
    expect(feedButton).not.toHaveClass("pl-7");
    const folderTarget = screen.getByRole("button", { name: "Move to Empty" });
    fireEvent.click(handle);
    fireEvent.click(folderTarget);

    expect(onDragStartFeed).toHaveBeenCalledWith(expect.objectContaining({ id: "feed-2" }));
    expect(onDropToFolder).toHaveBeenCalledWith("folder-empty");
  });

  it("applies compact density tokens to feed rows and drag handles", () => {
    render(
      <FeedTreeView
        isOpen={true}
        sidebarDensity="compact"
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
            isSelected: false,
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
            readerMode: "on",
            webPreviewMode: "off",
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

    expect(screen.getByRole("button", { name: "Drag Beta" })).toHaveClass("h-8");
    expect(screen.getByRole("button", { name: "Drag Beta" })).toHaveClass("w-8");
    expect(document.querySelector('[data-feed-id="feed-2"]')).not.toHaveClass("pl-8");
    expect(document.querySelector('[data-feed-id="feed-2"]')).toHaveClass("px-1.5");
    expect(screen.getByRole("button", { name: "Toggle folder Empty" })).toHaveClass("h-8");
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
            isSelected: false,
            feeds: [
              {
                id: "feed-1",
                accountId: "acc-1",
                folderId: "folder-source",
                title: "Alpha",
                url: "https://example.com/alpha.xml",
                siteUrl: "https://example.com/alpha",
                unreadCount: 0,
                readerMode: "on",
                webPreviewMode: "off",
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
            isSelected: false,
            feeds: [
              {
                id: "feed-2",
                accountId: "acc-1",
                folderId: "folder-target",
                title: "Gamma",
                url: "https://example.com/gamma.xml",
                siteUrl: "https://example.com/gamma",
                unreadCount: 0,
                readerMode: "on",
                webPreviewMode: "off",
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
    const callSequence: string[] = [];
    const onDragStartFeed = vi.fn((feed: { id: string }) => {
      callSequence.push(`start:${feed.id}`);
    });
    const onDragEnterFolder = vi.fn((folderId: string) => {
      callSequence.push(`enter:${folderId}`);
    });
    const onDropToFolder = vi.fn((folderId: string) => {
      callSequence.push(`drop:${folderId}`);
    });

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
            isSelected: false,
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
            readerMode: "on",
            webPreviewMode: "off",
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

    const targetButton = screen.getByRole("button", { name: "Select folder Target" });
    const originalElementFromPoint = document.elementFromPoint;
    try {
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
      expect(callSequence).toEqual(["start:feed-1", "enter:folder-target", "drop:folder-target"]);
    } finally {
      Object.defineProperty(document, "elementFromPoint", {
        configurable: true,
        value: originalElementFromPoint,
      });
    }
  });

  it("renders a drag overlay that follows the pointer while dragging", () => {
    render(
      <FeedTreeView
        isOpen={true}
        canDragFeeds={true}
        folders={[]}
        unfolderedFeeds={[
          {
            id: "feed-1",
            accountId: "acc-1",
            folderId: null,
            title: "Alpha",
            url: "https://example.com/alpha.xml",
            siteUrl: "https://example.com/alpha",
            unreadCount: 0,
            readerMode: "on",
            webPreviewMode: "off",
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

    fireEvent.pointerDown(screen.getByRole("button", { name: "Drag Alpha" }), {
      button: 0,
      clientX: 12,
      clientY: 16,
      pointerId: 1,
    });
    fireEvent.pointerMove(window, {
      clientX: 40,
      clientY: 52,
      pointerId: 1,
    });

    const overlay = screen.getByTestId("feed-tree-drag-overlay");
    expect(overlay).toHaveTextContent("Alpha");
    expect(overlay).toHaveStyle({ transform: "translate3d(52px, 64px, 0)" });
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
            isSelected: false,
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
            readerMode: "on",
            webPreviewMode: "off",
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
            isSelected: false,
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
            readerMode: "on",
            webPreviewMode: "off",
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

  it("does not show the unfoldered drop zone until a drag is active", () => {
    render(
      <FeedTreeView
        isOpen={true}
        canDragFeeds={true}
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
            isSelected: false,
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
            readerMode: "on",
            webPreviewMode: "off",
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

  it("does not treat an undefined dragged feed id as an active drag", () => {
    render(
      <FeedTreeView
        isOpen={true}
        canDragFeeds={true}
        activeDropTarget={null}
        folders={[
          {
            id: "folder-1",
            name: "Work",
            accountId: "acc-1",
            sortOrder: 0,
            unreadCount: 0,
            isExpanded: false,
            isSelected: false,
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
            readerMode: "on",
            webPreviewMode: "off",
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
    expect(screen.queryByRole("button", { name: "Move to Work" })).not.toBeInTheDocument();
  });

  it("switches pointer hover callbacks between folder and unfoldered targets", () => {
    const onDragEnterFolder = vi.fn();
    const onDragEnterUnfoldered = vi.fn();

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
            isSelected: false,
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
            readerMode: "on",
            webPreviewMode: "off",
            isSelected: false,
            grayscaleFavicon: false,
          },
        ]}
        onToggleFolder={vi.fn()}
        onSelectFeed={vi.fn()}
        onDragStartFeed={vi.fn()}
        onDragEnterFolder={onDragEnterFolder}
        onDragEnterUnfoldered={onDragEnterUnfoldered}
        onDropToFolder={vi.fn()}
        onDropToUnfoldered={vi.fn()}
        onDragEnd={vi.fn()}
        displayFavicons={false}
        emptyState={{ kind: "message", message: "No feeds yet" }}
      />,
    );

    const folderTarget = screen.getByRole("button", { name: "Select folder Target" });
    const originalElementFromPoint = document.elementFromPoint;

    try {
      Object.defineProperty(document, "elementFromPoint", {
        configurable: true,
        value: vi.fn((x: number) => {
          if (x < 40) {
            return folderTarget;
          }
          return screen.getByTestId("unfoldered-drop-zone");
        }),
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
      fireEvent.pointerMove(window, {
        clientX: 60,
        clientY: 60,
        pointerId: 1,
      });

      expect(onDragEnterFolder).toHaveBeenCalledWith("folder-target");
      expect(onDragEnterUnfoldered).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId("unfoldered-drop-zone")).toHaveClass("bg-sidebar-accent/60");
    } finally {
      Object.defineProperty(document, "elementFromPoint", {
        configurable: true,
        value: originalElementFromPoint,
      });
    }
  });

  it("tears down pointer drag state on Escape", () => {
    const onDragEnd = vi.fn();

    render(
      <FeedTreeView
        isOpen={true}
        canDragFeeds={true}
        folders={[]}
        unfolderedFeeds={[
          {
            id: "feed-1",
            accountId: "acc-1",
            folderId: null,
            title: "Alpha",
            url: "https://example.com/alpha.xml",
            siteUrl: "https://example.com/alpha",
            unreadCount: 0,
            readerMode: "on",
            webPreviewMode: "off",
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
        onDragEnd={onDragEnd}
        displayFavicons={false}
        emptyState={{ kind: "message", message: "No feeds yet" }}
      />,
    );

    fireEvent.pointerDown(screen.getByRole("button", { name: "Drag Alpha" }), {
      button: 0,
      clientX: 12,
      clientY: 16,
      pointerId: 1,
    });
    fireEvent.pointerMove(window, {
      clientX: 40,
      clientY: 52,
      pointerId: 1,
    });
    expect(screen.getByTestId("feed-tree-drag-overlay")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape" });

    expect(onDragEnd).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("feed-tree-drag-overlay")).not.toBeInTheDocument();
    expect(screen.queryByTestId("unfoldered-drop-zone")).not.toBeInTheDocument();
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
            isSelected: false,
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
            readerMode: "on",
            webPreviewMode: "off",
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

  it("localizes drag-and-drop labels in Japanese", async () => {
    await i18n.changeLanguage("ja");

    render(
      <FeedTreeView
        isOpen={true}
        canDragFeeds={true}
        draggedFeedId="feed-1"
        activeDropTarget={{ kind: "unfoldered" }}
        folders={[
          {
            id: "folder-1",
            name: "仕事",
            accountId: "acc-1",
            sortOrder: 0,
            unreadCount: 0,
            isExpanded: false,
            isSelected: false,
            feeds: [],
          },
        ]}
        unfolderedFeeds={[
          {
            id: "feed-1",
            accountId: "acc-1",
            folderId: null,
            title: "アルファ",
            url: "https://example.com/alpha.xml",
            siteUrl: "https://example.com/alpha",
            unreadCount: 1,
            readerMode: "on",
            webPreviewMode: "off",
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
        emptyState={{ kind: "message", message: "まだフィードがありません" }}
      />,
    );

    expect(screen.getByRole("button", { name: "仕事 フォルダを選択" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "仕事 に移動" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "アルファ をドラッグ" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "フォルダなしへ移動" })).toHaveTextContent(
      "ここにドロップしてフォルダから外す",
    );
  });
});
