import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Profiler } from "react";
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
    const onMarkFeedRead = vi.fn();
    const onMarkFolderRead = vi.fn();
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
        onMarkFeedRead={onMarkFeedRead}
        onMarkFolderRead={onMarkFolderRead}
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
    expect(screen.getByRole("button", { name: "Select folder Work" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: "Select folder Work" })).toHaveClass("min-h-9");
    expect(screen.getByRole("button", { name: "Select folder Work" })).toHaveClass("motion-contextual-surface");
    expect(screen.getByRole("button", { name: /Alpha/ })).toHaveClass("min-h-9");
    expect(screen.getByRole("button", { name: /Alpha/ })).toHaveClass("motion-contextual-surface");
    expect(screen.getByRole("button", { name: /Beta/ })).toHaveClass("min-h-9");

    await user.click(screen.getByRole("button", { name: "Select folder Work" }));
    await user.click(screen.getByRole("button", { name: /Alpha/ }));
    await user.click(screen.getByRole("button", { name: /Beta/ }));
    fireEvent.mouseDown(screen.getByRole("button", { name: "Select folder Work" }), { button: 1 });
    fireEvent.mouseDown(screen.getByRole("button", { name: /Alpha/ }), {
      button: 1,
    });

    expect(onToggleFolder).toHaveBeenCalledTimes(1);
    expect(onToggleFolder).toHaveBeenCalledWith("folder-1");
    expect(onSelectFeed).toHaveBeenNthCalledWith(1, "feed-1");
    expect(onSelectFeed).toHaveBeenNthCalledWith(2, "feed-2");
    expect(onMarkFolderRead).toHaveBeenCalledWith(expect.objectContaining({ id: "folder-1", unreadCount: 4 }));
    expect(onMarkFeedRead).toHaveBeenCalledWith(expect.objectContaining({ id: "feed-1", unreadCount: 4 }));
    expect(renderFeedContextMenu).toHaveBeenCalledWith(expect.objectContaining({ id: "feed-1", folderId: "folder-1" }));
    expect(renderFeedContextMenu).toHaveBeenCalledWith(expect.objectContaining({ id: "feed-2", folderId: null }));
  });

  it("keeps the right-clicked feed as the context menu target when feed data updates while open", () => {
    const renderFeedContextMenu = vi.fn((feed: { title: string }) => (
      <div data-testid="feed-context-target">{feed.title}</div>
    ));
    const makeFeedTree = (title: string) => (
      <FeedTreeView
        isOpen={true}
        folders={[]}
        unfolderedFeeds={[
          {
            id: "feed-1",
            accountId: "acc-1",
            folderId: null,
            title,
            url: "https://example.com/feed.xml",
            siteUrl: "https://example.com",
            unreadCount: 1,
            readerMode: "on",
            webPreviewMode: "off",
            isSelected: false,
            grayscaleFavicon: false,
          },
        ]}
        onToggleFolder={vi.fn()}
        onSelectFeed={vi.fn()}
        onMarkFeedRead={vi.fn()}
        onMarkFolderRead={vi.fn()}
        displayFavicons={false}
        emptyState={{ kind: "message", message: "No feeds yet" }}
        renderFeedContextMenu={renderFeedContextMenu}
      />
    );

    const { rerender } = render(makeFeedTree("Alpha"));

    fireEvent.contextMenu(screen.getByRole("button", { name: /Alpha/ }));
    rerender(makeFeedTree("Renamed feed"));

    expect(screen.getByTestId("feed-context-target")).toHaveTextContent("Alpha");
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

  it("renders the large feed tree used by the account switch smoke path", () => {
    let renderDuration = 0;
    const folderCount = 8;
    const feedsPerFolder = 10;
    const folders = Array.from({ length: folderCount }, (_, folderIndex) => ({
      id: `folder-${folderIndex}`,
      name: `Folder ${folderIndex}`,
      accountId: "acc-large",
      sortOrder: folderIndex,
      unreadCount: feedsPerFolder,
      isExpanded: true,
      isSelected: false,
      feeds: Array.from({ length: feedsPerFolder }, (_, feedIndex) => ({
        id: `feed-${folderIndex}-${feedIndex}`,
        accountId: "acc-large",
        folderId: `folder-${folderIndex}`,
        title: `Feed ${folderIndex}-${feedIndex}`,
        url: `https://example.com/${folderIndex}/${feedIndex}.xml`,
        siteUrl: `https://example.com/${folderIndex}/${feedIndex}`,
        unreadCount: 1,
        readerMode: "on" as const,
        webPreviewMode: "off" as const,
        isSelected: false,
        grayscaleFavicon: false,
      })),
    }));

    render(
      <Profiler
        id="large-feed-tree"
        onRender={(_id, _phase, actualDuration) => {
          renderDuration += actualDuration;
        }}
      >
        <FeedTreeView
          isOpen={true}
          folders={folders}
          unfolderedFeeds={[]}
          onToggleFolder={vi.fn()}
          onSelectFeed={vi.fn()}
          displayFavicons={false}
          emptyState={{ kind: "message", message: "No feeds yet" }}
        />
      </Profiler>,
    );

    expect(screen.getByRole("button", { name: /Feed 7-9/ })).toBeInTheDocument();
    expect(renderDuration).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(renderDuration)).toBe(true);
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

    expect(onSelectFolder).toHaveBeenCalledWith("folder-1");
    expect(onToggleFolder).toHaveBeenCalledWith("folder-1");
  });

  it("renders selected folder indicator from the folder row edge and hides the button marker", () => {
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

    const folderButton = screen.getByRole("button", {
      name: "Select folder Work",
    });
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

  it("renders nothing when the empty state is intentionally hidden", () => {
    const { container } = render(
      <FeedTreeView
        isOpen={true}
        folders={[]}
        unfolderedFeeds={[]}
        onToggleFolder={vi.fn()}
        onSelectFeed={vi.fn()}
        displayFavicons={false}
        emptyState={{ kind: "hidden" }}
      />,
    );

    expect(container).toBeEmptyDOMElement();
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
    expect(handle).toHaveClass("size-9");
    expect(handle).toHaveClass("group-hover/feed-row:opacity-100");
    expect(feedButton).not.toBeNull();
    expect(feedButton).not.toHaveClass("pl-7");
    const folderTarget = screen.getByRole("button", { name: "Move to Empty" });
    expect(folderTarget).toHaveClass("absolute", "inset-y-0", "right-0", "left-8", "z-10", "rounded-r-md");
    expect(folderTarget).not.toHaveClass("motion-contextual-surface");
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

    expect(screen.getByRole("button", { name: "Drag Beta" })).toHaveClass("size-8");
    expect(document.querySelector('[data-feed-id="feed-2"]')).not.toHaveClass("pl-8");
    expect(document.querySelector('[data-feed-id="feed-2"]')).toHaveClass("px-1.5");
    expect(screen.getByRole("button", { name: "Select folder Empty" })).toHaveClass("min-h-8");
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

    const targetButton = screen.getByRole("button", {
      name: "Select folder Target",
    });
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
        displayFavicons={true}
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
    expect(overlay.className).not.toContain("motion-");
    expect(overlay.firstElementChild).toHaveClass(
      "border-[var(--sidebar-frame-border)]",
      "bg-[var(--sidebar-frame-solid-surface)]",
      "px-2",
      "py-1.5",
    );
    expect(overlay.firstElementChild?.className).not.toContain("motion-");
    const overlayFaviconSlot = overlay.querySelector("img")?.parentElement;
    expect(overlayFaviconSlot).toHaveClass("size-5");
    expect(overlayFaviconSlot).not.toHaveClass("h-5", "w-5");
  });

  it("keeps pointer drag window listeners stable while preview state changes", () => {
    const addEventListenerSpy = vi.spyOn(window, "addEventListener");
    const removeEventListenerSpy = vi.spyOn(window, "removeEventListener");
    const dragWindowEventTypes = new Set(["pointermove", "pointerup", "pointercancel", "keydown", "blur"]);
    const getDragListenerAdds = () =>
      addEventListenerSpy.mock.calls.filter(([type]) => dragWindowEventTypes.has(String(type))).length;
    const getDragListenerRemoves = () =>
      removeEventListenerSpy.mock.calls.filter(([type]) => dragWindowEventTypes.has(String(type))).length;

    try {
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
          displayFavicons={true}
          emptyState={{ kind: "message", message: "No feeds yet" }}
        />,
      );

      fireEvent.pointerDown(screen.getByRole("button", { name: "Drag Alpha" }), {
        button: 0,
        clientX: 12,
        clientY: 16,
        pointerId: 1,
      });

      const listenerAddsAfterSessionStart = getDragListenerAdds();
      const listenerRemovesAfterSessionStart = getDragListenerRemoves();
      expect(listenerAddsAfterSessionStart).toBe(5);

      fireEvent.pointerMove(window, {
        clientX: 40,
        clientY: 52,
        pointerId: 1,
      });

      expect(screen.getByTestId("feed-tree-drag-overlay")).toHaveTextContent("Alpha");
      expect(getDragListenerAdds()).toBe(listenerAddsAfterSessionStart);
      expect(getDragListenerRemoves()).toBe(listenerRemovesAfterSessionStart);

      fireEvent.pointerUp(window, {
        clientX: 40,
        clientY: 52,
        pointerId: 1,
      });
    } finally {
      addEventListenerSpy.mockRestore();
      removeEventListenerSpy.mockRestore();
    }
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
    const dropTarget = screen.getByRole("button", { name: "Move to Target" });
    expect(dropTarget).toHaveAttribute("tabIndex", "-1");
    fireEvent.click(dropTarget);

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

    const dropZone = screen.getByTestId("unfoldered-drop-zone");
    expect(dropZone).toHaveClass("bg-[var(--feed-tree-drop-target-surface)]");
    expect(dropZone).toHaveClass("border-dashed", "min-h-11");
    expect(dropZone).toHaveClass("motion-resize-surface");
    expect(dropZone).not.toHaveClass("motion-contextual-surface");
    expect(dropZone).not.toHaveClass("transition-all");
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

    const folderTarget = screen.getByRole("button", {
      name: "Select folder Target",
    });
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
      expect(screen.getByTestId("unfoldered-drop-zone")).toHaveClass("bg-[var(--feed-tree-drop-target-surface)]");
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

  it("tears down pointer drag state when the window loses focus", () => {
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

    fireEvent.blur(window);

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
