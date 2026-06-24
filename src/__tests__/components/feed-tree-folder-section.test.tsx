import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { FeedTreeFolderViewModel } from "@/components/reader/feed-tree.types";
import { FeedTreeFolderSection } from "@/components/reader/feed-tree-folder-section";

const baseFolder: FeedTreeFolderViewModel = {
  id: "folder-1",
  name: "Comic",
  accountId: "acc-1",
  sortOrder: 0,
  unreadCount: 9274,
  isExpanded: false,
  isSelected: true,
  feeds: [],
};

describe("FeedTreeFolderSection", () => {
  it("keeps some inset between the selected folder border and its label", () => {
    render(
      <FeedTreeFolderSection
        folder={baseFolder}
        activeDropTarget={null}
        onToggleFolder={vi.fn()}
        onSelectFolder={vi.fn()}
        onSelectFeed={vi.fn()}
        displayFavicons={false}
      />,
    );

    const folderButton = screen.getByRole("button", {
      name: "Select folder Comic",
    });
    const toggleButton = screen.getByRole("button", {
      name: "Toggle folder Comic",
    });

    expect(folderButton).toHaveClass("pl-0.5");
    expect(folderButton).toHaveClass("-ml-1");
    expect(folderButton.querySelector("span")).not.toHaveClass("-ml-1");
    expect(folderButton).toHaveClass("rounded-lg");
    expect(folderButton).not.toHaveClass("pl-0");
    expect(toggleButton).toHaveClass("select-none", "hover:bg-[var(--sidebar-hover-surface)]");
    expect(toggleButton).toHaveClass("size-9");
    expect(screen.getByText("Comic")).toHaveClass("font-medium");
    expect(screen.getByText("9,274")).toHaveClass("text-[0.72rem]", "text-sidebar-foreground/54");
    expect(folderButton.querySelector("svg")).not.toBeInTheDocument();
  });

  it("adds a folder icon slot when feed favicons are visible", () => {
    render(
      <FeedTreeFolderSection
        folder={baseFolder}
        activeDropTarget={null}
        onToggleFolder={vi.fn()}
        onSelectFolder={vi.fn()}
        onSelectFeed={vi.fn()}
        displayFavicons={true}
      />,
    );

    const folderButton = screen.getByRole("button", {
      name: "Select folder Comic",
    });

    expect(folderButton).toHaveClass("pl-0.5");
    expect(folderButton).toHaveClass("-ml-1");
    expect(folderButton.querySelector("span")).not.toHaveClass("-ml-1");
    expect(folderButton.querySelector("svg")).toHaveClass("size-3.5");
  });

  it("keeps the folder toggle in normal row flow so the selection bar stays off the chevron rail", () => {
    render(
      <FeedTreeFolderSection
        folder={baseFolder}
        activeDropTarget={null}
        onToggleFolder={vi.fn()}
        onSelectFolder={vi.fn()}
        onSelectFeed={vi.fn()}
        displayFavicons={false}
      />,
    );

    const folderButton = screen.getByRole("button", {
      name: "Select folder Comic",
    });
    const selectedIndicator = document.querySelector<HTMLElement>("[data-folder-row-selected-indicator='folder-1']");

    expect(folderButton).toHaveClass("pl-0.5");
    expect(folderButton).not.toHaveClass("pl-7");
    expect(selectedIndicator?.parentElement).toHaveClass("flex", "items-center", "gap-0.5");
  });

  it("aligns the child rail with the disclosure chevron wire", () => {
    render(
      <FeedTreeFolderSection
        folder={{
          ...baseFolder,
          isExpanded: true,
          feeds: [
            {
              id: "feed-1",
              accountId: "acc-1",
              folderId: "folder-1",
              title: "Alpha",
              url: "https://example.com/feed.xml",
              siteUrl: "https://example.com",
              unreadCount: 1,
              readerMode: "on",
              webPreviewMode: "off",
              isSelected: false,
              grayscaleFavicon: false,
            },
          ],
        }}
        activeDropTarget={null}
        onToggleFolder={vi.fn()}
        onSelectFolder={vi.fn()}
        onSelectFeed={vi.fn()}
        displayFavicons={true}
      />,
    );

    const folderPanel = document.getElementById("feed-tree-folder-panel-folder-1");
    const childRail = folderPanel?.querySelector(".border-l");

    expect(childRail).toHaveClass("ml-[1.125rem]", "pl-3");
    expect(childRail).not.toHaveClass("ml-2");
  });

  it("does not mark a zero-unread folder read on middle click", () => {
    const onSelectFolder = vi.fn();
    const onMarkFolderRead = vi.fn();

    render(
      <FeedTreeFolderSection
        folder={{ ...baseFolder, unreadCount: 0, isSelected: false }}
        activeDropTarget={null}
        onToggleFolder={vi.fn()}
        onSelectFolder={onSelectFolder}
        onSelectFeed={vi.fn()}
        onMarkFolderRead={onMarkFolderRead}
        displayFavicons={false}
      />,
    );

    fireEvent.mouseDown(screen.getByRole("button", { name: "Select folder Comic" }), { button: 1 });

    expect(onMarkFolderRead).not.toHaveBeenCalled();
    expect(onSelectFolder).not.toHaveBeenCalled();
  });

  it("keeps the right-clicked folder as the context menu target when folder data updates while open", () => {
    const renderFolderContextMenu = vi.fn((folder: FeedTreeFolderViewModel) => (
      <div data-testid="folder-context-target">{folder.name}</div>
    ));

    const { rerender } = render(
      <FeedTreeFolderSection
        folder={baseFolder}
        activeDropTarget={null}
        onToggleFolder={vi.fn()}
        onSelectFolder={vi.fn()}
        onSelectFeed={vi.fn()}
        displayFavicons={false}
        renderFolderContextMenu={renderFolderContextMenu}
      />,
    );

    fireEvent.contextMenu(screen.getByRole("button", { name: "Select folder Comic" }));

    rerender(
      <FeedTreeFolderSection
        folder={{ ...baseFolder, name: "Renamed folder" }}
        activeDropTarget={null}
        onToggleFolder={vi.fn()}
        onSelectFolder={vi.fn()}
        onSelectFeed={vi.fn()}
        displayFavicons={false}
        renderFolderContextMenu={renderFolderContextMenu}
      />,
    );

    expect(screen.getByTestId("folder-context-target")).toHaveTextContent("Comic");
  });

  it("uses a softer active drop tone for folder targets", () => {
    render(
      <FeedTreeFolderSection
        folder={baseFolder}
        activeDropTarget={{ kind: "folder", folderId: "folder-1" }}
        draggedFeedId="feed-2"
        onToggleFolder={vi.fn()}
        onSelectFolder={vi.fn()}
        onSelectFeed={vi.fn()}
        displayFavicons={false}
        canDragFeeds={true}
      />,
    );

    const folderButton = screen.getByRole("button", {
      name: "Select folder Comic",
    });
    const row = folderButton.closest("div.rounded-md");

    expect(row).toHaveClass("bg-[var(--feed-tree-active-folder-surface)]");
    expect(folderButton).toHaveClass("bg-[var(--feed-tree-drop-target-surface)]");
  });

  it("keeps the drag drop overlay inset from the folder disclosure control", () => {
    render(
      <FeedTreeFolderSection
        folder={baseFolder}
        activeDropTarget={{ kind: "folder", folderId: "folder-1" }}
        draggedFeedId="feed-2"
        onToggleFolder={vi.fn()}
        onSelectFolder={vi.fn()}
        onSelectFeed={vi.fn()}
        displayFavicons={false}
        canDragFeeds={true}
      />,
    );

    const dropOverlay = screen.getByRole("button", { name: "Move to Comic" });

    expect(dropOverlay).toHaveClass("left-8", "right-0", "rounded-r-md");
    expect(dropOverlay).not.toHaveClass("inset-0");
  });

  it("keeps the folder feed panel mounted with animated collapse state", () => {
    render(
      <FeedTreeFolderSection
        folder={{
          ...baseFolder,
          isExpanded: false,
          feeds: [
            {
              id: "feed-1",
              accountId: "acc-1",
              folderId: "folder-1",
              title: "Alpha",
              url: "https://example.com/feed.xml",
              siteUrl: "https://example.com",
              unreadCount: 1,
              readerMode: "on",
              webPreviewMode: "off",
              isSelected: false,
              grayscaleFavicon: false,
            },
          ],
        }}
        activeDropTarget={null}
        onToggleFolder={vi.fn()}
        onSelectFolder={vi.fn()}
        onSelectFeed={vi.fn()}
        displayFavicons={false}
      />,
    );

    const toggleButton = screen.getByRole("button", {
      name: "Toggle folder Comic",
    });
    const folderPanel = document.getElementById("feed-tree-folder-panel-folder-1");

    expect(toggleButton).toHaveClass("motion-disclosure-trigger");
    expect(toggleButton.querySelector("svg")).toHaveClass("motion-disclosure-icon");
    expect(folderPanel).toHaveAttribute("aria-hidden", "true");
    expect(folderPanel).toHaveAttribute("inert");
    expect(folderPanel).toHaveClass("motion-disclosure-panel");
  });

  it("pairs the folder disclosure control with the collapsed panel aria state", () => {
    render(
      <FeedTreeFolderSection
        folder={{ ...baseFolder, isExpanded: false }}
        activeDropTarget={null}
        onToggleFolder={vi.fn()}
        onSelectFolder={vi.fn()}
        onSelectFeed={vi.fn()}
        displayFavicons={false}
      />,
    );

    const toggleButton = screen.getByRole("button", {
      name: "Toggle folder Comic",
    });
    const panelId = toggleButton.getAttribute("aria-controls");
    expect(panelId).toBe("feed-tree-folder-panel-folder-1");
    expect(toggleButton).toHaveAttribute("aria-expanded", "false");
    expect(document.getElementById(panelId ?? "")).toHaveAttribute("aria-hidden", "true");
    expect(document.getElementById(panelId ?? "")).toHaveAttribute("inert");
  });

  it("pairs the folder disclosure control with the expanded panel aria state when children exist", () => {
    render(
      <FeedTreeFolderSection
        folder={{
          ...baseFolder,
          isExpanded: true,
          feeds: [
            {
              id: "feed-1",
              accountId: "acc-1",
              folderId: "folder-1",
              title: "Alpha",
              url: "https://example.com/feed.xml",
              siteUrl: "https://example.com",
              unreadCount: 1,
              readerMode: "on",
              webPreviewMode: "off",
              isSelected: false,
              grayscaleFavicon: false,
            },
          ],
        }}
        activeDropTarget={null}
        onToggleFolder={vi.fn()}
        onSelectFolder={vi.fn()}
        onSelectFeed={vi.fn()}
        displayFavicons={false}
      />,
    );

    const toggleButton = screen.getByRole("button", {
      name: "Toggle folder Comic",
    });
    const panelId = toggleButton.getAttribute("aria-controls");
    const panel = document.getElementById(panelId ?? "");
    expect(toggleButton).toHaveAttribute("aria-expanded", "true");
    expect(panel).toHaveAttribute("aria-hidden", "false");
    expect(panel).not.toHaveAttribute("inert");
    expect(screen.getByRole("button", { name: /Alpha/ }).closest(`#${panelId}`)).toBeInTheDocument();
  });
});
