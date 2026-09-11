import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FeedTreeView } from "@/components/reader/feed-tree-view";
import { MOTION_DATA_SIDEBAR_ROW_LEAVING_ATTRIBUTE, MOTION_SIDEBAR_ROW_EXIT_DURATION_MS } from "@/constants";
import i18n from "@/lib/i18n";

type Feed = {
  id: string;
  accountId: string;
  folderId: string | null;
  title: string;
  url: string;
  siteUrl: string;
  unreadCount: number;
  readerMode: "on" | "off" | "inherit";
  webPreviewMode: "on" | "off" | "inherit";
  isSelected: boolean;
  grayscaleFavicon: boolean;
};

function makeFeed(overrides: Partial<Feed>): Feed {
  return {
    id: "feed-1",
    accountId: "acc-1",
    folderId: null,
    title: "Feed",
    url: "https://example.com/feed.xml",
    siteUrl: "https://example.com",
    unreadCount: 0,
    readerMode: "inherit",
    webPreviewMode: "inherit",
    isSelected: false,
    grayscaleFavicon: false,
    ...overrides,
  };
}

const leavingRowSelector = `[${MOTION_DATA_SIDEBAR_ROW_LEAVING_ATTRIBUTE}="true"]`;

describe("FeedTreeView presence wiring", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("retains an unselected feed that becomes unread-0 through the exit duration, then removes it", () => {
    const feedA = makeFeed({ id: "feed-a", title: "Alpha", unreadCount: 1 });
    const feedB = makeFeed({ id: "feed-b", title: "Beta", unreadCount: 1 });

    const { rerender } = render(
      <FeedTreeView
        isOpen={true}
        scopeKey="acc-1:unread"
        folders={[]}
        unfolderedFeeds={[feedA, feedB]}
        onToggleFolder={vi.fn()}
        onSelectFeed={vi.fn()}
        displayFavicons={false}
        emptyState={{ kind: "message", message: "No feeds yet" }}
      />,
    );

    // "Beta" clears its unread count and drops out of the logical (unread)
    // view, but must keep rendering while it exits.
    rerender(
      <FeedTreeView
        isOpen={true}
        scopeKey="acc-1:unread"
        folders={[]}
        unfolderedFeeds={[feedA]}
        onToggleFolder={vi.fn()}
        onSelectFeed={vi.fn()}
        displayFavicons={false}
        emptyState={{ kind: "message", message: "No feeds yet" }}
      />,
    );

    expect(screen.getByRole("button", { name: /Beta/ })).toBeInTheDocument();
    expect(document.querySelector(`[data-feed-id="feed-b"]`)?.closest(leavingRowSelector)).not.toBeNull();

    vi.advanceTimersByTime(MOTION_SIDEBAR_ROW_EXIT_DURATION_MS);
    rerender(
      <FeedTreeView
        isOpen={true}
        scopeKey="acc-1:unread"
        folders={[]}
        unfolderedFeeds={[feedA]}
        onToggleFolder={vi.fn()}
        onSelectFeed={vi.fn()}
        displayFavicons={false}
        emptyState={{ kind: "message", message: "No feeds yet" }}
      />,
    );

    expect(screen.queryByRole("button", { name: /Beta/ })).not.toBeInTheDocument();
  });

  it("excludes a leaving feed row from sidebar keyboard navigation targets", () => {
    const feedA = makeFeed({ id: "feed-a", title: "Alpha", unreadCount: 1 });
    const feedB = makeFeed({ id: "feed-b", title: "Beta", unreadCount: 1 });

    const { rerender } = render(
      <FeedTreeView
        isOpen={true}
        scopeKey="acc-1:unread"
        folders={[]}
        unfolderedFeeds={[feedA, feedB]}
        onToggleFolder={vi.fn()}
        onSelectFeed={vi.fn()}
        displayFavicons={false}
        emptyState={{ kind: "message", message: "No feeds yet" }}
      />,
    );

    expect(document.querySelector('[data-feed-id="feed-b"]')).toHaveAttribute("data-sidebar-navigation-target", "true");

    rerender(
      <FeedTreeView
        isOpen={true}
        scopeKey="acc-1:unread"
        folders={[]}
        unfolderedFeeds={[feedA]}
        onToggleFolder={vi.fn()}
        onSelectFeed={vi.fn()}
        displayFavicons={false}
        emptyState={{ kind: "message", message: "No feeds yet" }}
      />,
    );

    const leavingButton = document.querySelector('[data-feed-id="feed-b"]');
    expect(leavingButton).not.toHaveAttribute("data-sidebar-navigation-target");
  });

  it("drops a leaving feed row out of the tab order and stops it selecting", () => {
    const feedA = makeFeed({ id: "feed-a", title: "Alpha", unreadCount: 1 });
    const feedB = makeFeed({ id: "feed-b", title: "Beta", unreadCount: 1 });
    const onSelectFeed = vi.fn();

    const { rerender } = render(
      <FeedTreeView
        isOpen={true}
        scopeKey="acc-1:unread"
        folders={[]}
        unfolderedFeeds={[feedA, feedB]}
        onToggleFolder={vi.fn()}
        onSelectFeed={onSelectFeed}
        displayFavicons={false}
        emptyState={{ kind: "message", message: "No feeds yet" }}
      />,
    );

    expect(document.querySelector('[data-feed-id="feed-b"]')).not.toHaveAttribute("tabindex", "-1");

    rerender(
      <FeedTreeView
        isOpen={true}
        scopeKey="acc-1:unread"
        folders={[]}
        unfolderedFeeds={[feedA]}
        onToggleFolder={vi.fn()}
        onSelectFeed={onSelectFeed}
        displayFavicons={false}
        emptyState={{ kind: "message", message: "No feeds yet" }}
      />,
    );

    const leaving = document.querySelector('[data-feed-id="feed-b"]');
    // A keyboard-issued `contextmenu` targets whatever holds focus, so the
    // collapse wrapper's `pointer-events: none` does not close that path on its
    // own; leaving the tab order is what does.
    expect(leaving).toHaveAttribute("tabindex", "-1");

    onSelectFeed.mockClear();
    (leaving as HTMLElement).click();
    expect(onSelectFeed).not.toHaveBeenCalled();
  });

  it("excludes a leaving folder from drop-target attributes", () => {
    const folder = {
      id: "folder-a",
      name: "Work",
      accountId: "acc-1",
      sortOrder: 0,
      unreadCount: 1,
      isExpanded: false,
      isSelected: false,
      feeds: [makeFeed({ id: "feed-a", folderId: "folder-a", unreadCount: 1 })],
    };

    const { rerender } = render(
      <FeedTreeView
        isOpen={true}
        scopeKey="acc-1:unread"
        canDragFeeds={true}
        folders={[folder]}
        unfolderedFeeds={[]}
        onToggleFolder={vi.fn()}
        onSelectFeed={vi.fn()}
        displayFavicons={false}
        emptyState={{ kind: "message", message: "No feeds yet" }}
      />,
    );

    expect(screen.getByRole("button", { name: "Select folder Work" })).toHaveAttribute("data-feed-drop-target");

    rerender(
      <FeedTreeView
        isOpen={true}
        scopeKey="acc-1:unread"
        canDragFeeds={true}
        folders={[]}
        unfolderedFeeds={[]}
        onToggleFolder={vi.fn()}
        onSelectFeed={vi.fn()}
        displayFavicons={false}
        emptyState={{ kind: "message", message: "No feeds yet" }}
      />,
    );

    const folderButton = screen.getByRole("button", { name: "Select folder Work" });
    expect(folderButton).not.toHaveAttribute("data-feed-drop-target");
    expect(folderButton.closest("[data-feed-drop-kind]")).toBeNull();
  });

  it("moves focus to a surviving sidebar target when the focused row starts leaving", () => {
    const feedA = makeFeed({ id: "feed-a", title: "Alpha", unreadCount: 1, isSelected: true });
    const feedB = makeFeed({ id: "feed-b", title: "Beta", unreadCount: 1 });

    const { rerender } = render(
      <FeedTreeView
        isOpen={true}
        scopeKey="acc-1:unread"
        folders={[]}
        unfolderedFeeds={[feedA, feedB]}
        onToggleFolder={vi.fn()}
        onSelectFeed={vi.fn()}
        displayFavicons={false}
        emptyState={{ kind: "message", message: "No feeds yet" }}
      />,
    );

    const betaButton = screen.getByRole("button", { name: /Beta/ });
    betaButton.focus();
    expect(document.activeElement).toBe(betaButton);

    rerender(
      <FeedTreeView
        isOpen={true}
        scopeKey="acc-1:unread"
        folders={[]}
        unfolderedFeeds={[feedA]}
        onToggleFolder={vi.fn()}
        onSelectFeed={vi.fn()}
        displayFavicons={false}
        emptyState={{ kind: "message", message: "No feeds yet" }}
      />,
    );

    const alphaButton = screen.getByRole("button", { name: /Alpha/ });
    expect(document.activeElement).toBe(alphaButton);
  });

  it("does not steal focus from outside the sidebar when an unrelated row starts leaving", () => {
    const feedA = makeFeed({ id: "feed-a", title: "Alpha", unreadCount: 1 });
    const feedB = makeFeed({ id: "feed-b", title: "Beta", unreadCount: 1 });
    const outsideButton = document.createElement("button");
    outsideButton.textContent = "Outside";
    document.body.appendChild(outsideButton);

    try {
      const { rerender } = render(
        <FeedTreeView
          isOpen={true}
          scopeKey="acc-1:unread"
          folders={[]}
          unfolderedFeeds={[feedA, feedB]}
          onToggleFolder={vi.fn()}
          onSelectFeed={vi.fn()}
          displayFavicons={false}
          emptyState={{ kind: "message", message: "No feeds yet" }}
        />,
      );

      outsideButton.focus();
      expect(document.activeElement).toBe(outsideButton);

      rerender(
        <FeedTreeView
          isOpen={true}
          scopeKey="acc-1:unread"
          folders={[]}
          unfolderedFeeds={[feedA]}
          onToggleFolder={vi.fn()}
          onSelectFeed={vi.fn()}
          displayFavicons={false}
          emptyState={{ kind: "message", message: "No feeds yet" }}
        />,
      );

      expect(document.activeElement).toBe(outsideButton);
    } finally {
      outsideButton.remove();
    }
  });

  it("retreats a folder as a whole when its last child disappears, keeping the child's own exit animating", () => {
    const feed = makeFeed({ id: "feed-a", folderId: "folder-a", unreadCount: 1 });
    const folder = {
      id: "folder-a",
      name: "Work",
      accountId: "acc-1",
      sortOrder: 0,
      unreadCount: 1,
      isExpanded: true,
      isSelected: false,
      feeds: [feed],
    };

    const { rerender } = render(
      <FeedTreeView
        isOpen={true}
        scopeKey="acc-1:unread"
        folders={[folder]}
        unfolderedFeeds={[]}
        onToggleFolder={vi.fn()}
        onSelectFeed={vi.fn()}
        displayFavicons={false}
        emptyState={{ kind: "message", message: "No feeds yet" }}
      />,
    );

    rerender(
      <FeedTreeView
        isOpen={true}
        scopeKey="acc-1:unread"
        folders={[]}
        unfolderedFeeds={[]}
        onToggleFolder={vi.fn()}
        onSelectFeed={vi.fn()}
        displayFavicons={false}
        emptyState={{ kind: "message", message: "No feeds yet" }}
      />,
    );

    // The folder and its last child both keep rendering through the exit
    // duration — neither disappears before the animation had a chance to
    // run against it.
    expect(screen.getByRole("button", { name: "Select folder Work" })).toBeInTheDocument();
    expect(document.querySelector('[data-feed-id="feed-a"]')).toBeInTheDocument();

    // Exactly one ancestor in the tree owns the collapse — the folder — not
    // both the folder and its child.
    const leavingWrappers = document.querySelectorAll(leavingRowSelector);
    expect(leavingWrappers).toHaveLength(1);
    expect(leavingWrappers[0]?.querySelector('[data-feed-id="feed-a"]')).not.toBeNull();

    vi.advanceTimersByTime(MOTION_SIDEBAR_ROW_EXIT_DURATION_MS);
    rerender(
      <FeedTreeView
        isOpen={true}
        scopeKey="acc-1:unread"
        folders={[]}
        unfolderedFeeds={[]}
        onToggleFolder={vi.fn()}
        onSelectFeed={vi.fn()}
        displayFavicons={false}
        emptyState={{ kind: "message", message: "No feeds yet" }}
      />,
    );

    expect(screen.queryByRole("button", { name: "Select folder Work" })).not.toBeInTheDocument();
  });

  it("collapses only the leaving child, not the still-present folder, when one sibling leaves", () => {
    const stayingFeed = makeFeed({ id: "feed-stay", folderId: "folder-a", unreadCount: 1 });
    const leavingFeed = makeFeed({ id: "feed-leave", folderId: "folder-a", unreadCount: 1 });
    const folderWithBoth = {
      id: "folder-a",
      name: "Work",
      accountId: "acc-1",
      sortOrder: 0,
      unreadCount: 2,
      isExpanded: true,
      isSelected: false,
      feeds: [stayingFeed, leavingFeed],
    };
    const folderWithStayingOnly = { ...folderWithBoth, unreadCount: 1, feeds: [stayingFeed] };

    const { rerender } = render(
      <FeedTreeView
        isOpen={true}
        scopeKey="acc-1:unread"
        folders={[folderWithBoth]}
        unfolderedFeeds={[]}
        onToggleFolder={vi.fn()}
        onSelectFeed={vi.fn()}
        displayFavicons={false}
        emptyState={{ kind: "message", message: "No feeds yet" }}
      />,
    );

    rerender(
      <FeedTreeView
        isOpen={true}
        scopeKey="acc-1:unread"
        folders={[folderWithStayingOnly]}
        unfolderedFeeds={[]}
        onToggleFolder={vi.fn()}
        onSelectFeed={vi.fn()}
        displayFavicons={false}
        emptyState={{ kind: "message", message: "No feeds yet" }}
      />,
    );

    const leavingWrappers = document.querySelectorAll(leavingRowSelector);
    expect(leavingWrappers).toHaveLength(1);
    // The single collapse owner scopes to the leaving child only, not the
    // whole folder: it must not contain the folder's own nav button.
    expect(leavingWrappers[0]?.querySelector('[data-feed-id="feed-leave"]')).not.toBeNull();
    expect(screen.queryByRole("button", { name: "Select folder Work" })?.closest(leavingRowSelector)).toBeNull();
  });

  it("does not switch to the empty state while a retained row is still leaving from an otherwise-empty tree", () => {
    const feedA = makeFeed({ id: "feed-a", title: "Alpha", unreadCount: 1 });

    const { rerender } = render(
      <FeedTreeView
        isOpen={true}
        scopeKey="acc-1:unread"
        folders={[]}
        unfolderedFeeds={[feedA]}
        onToggleFolder={vi.fn()}
        onSelectFeed={vi.fn()}
        displayFavicons={false}
        emptyState={{ kind: "message", message: "No feeds yet" }}
      />,
    );

    rerender(
      <FeedTreeView
        isOpen={true}
        scopeKey="acc-1:unread"
        folders={[]}
        unfolderedFeeds={[]}
        onToggleFolder={vi.fn()}
        onSelectFeed={vi.fn()}
        displayFavicons={false}
        emptyState={{ kind: "message", message: "No feeds yet" }}
      />,
    );

    expect(screen.queryByText("No feeds yet")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Alpha/ })).toBeInTheDocument();

    vi.advanceTimersByTime(MOTION_SIDEBAR_ROW_EXIT_DURATION_MS);
    rerender(
      <FeedTreeView
        isOpen={true}
        scopeKey="acc-1:unread"
        folders={[]}
        unfolderedFeeds={[]}
        onToggleFolder={vi.fn()}
        onSelectFeed={vi.fn()}
        displayFavicons={false}
        emptyState={{ kind: "message", message: "No feeds yet" }}
      />,
    );

    expect(screen.getByText("No feeds yet")).toBeInTheDocument();
  });
});
