import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { sampleFeeds, sampleFolders } from "@tests/helpers/fixtures";
import { flushTestMutationObservers } from "@tests/setup";
import { useRef, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FeedDto } from "@/api/tauri-commands";
import { FeedTreeView } from "@/components/reader/feed-tree-view";
import { useSidebarFeedSectionController } from "@/components/reader/hooks/sidebar/use-sidebar-feed-section-controller";
import i18n from "@/lib/i18n";
import { FEED_MOVE_FEED_ROW_ATTRIBUTE, FEED_MOVE_FOLDER_ROW_ATTRIBUTE } from "@/lib/sidebar/feed-move-animation";

vi.mock("@/hooks/use-feed-landing", () => ({ useFeedLanding: () => vi.fn() }));
vi.mock("@/hooks/use-articles", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/hooks/use-articles")>()),
  useMarkFeedRead: () => ({ mutate: vi.fn() }),
  useMarkFolderRead: () => ({ mutate: vi.fn() }),
  useMarkOldUnreadRead: () => ({ mutate: vi.fn() }),
}));
vi.mock("@/hooks/use-confirm-mark-all-read", () => ({ useConfirmMarkAllRead: () => vi.fn() }));
vi.mock("@/hooks/use-folder-reorder", () => ({
  useReorderFolders: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
  useResetFolderOrder: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
}));

const ROW_HEIGHT = 20;
const MOTION_ROW_SELECTOR = `[${FEED_MOVE_FEED_ROW_ATTRIBUTE}], [${FEED_MOVE_FOLDER_ROW_ATTRIBUTE}]`;

const folders = [
  { ...sampleFolders[0], id: "folder-a", account_id: "acc-1", name: "Alpha", sort_order: 0 },
  { ...sampleFolders[0], id: "folder-b", account_id: "acc-1", name: "Bravo", sort_order: 1 },
];

function buildFeed(id: string, title: string, folderId: string | null): FeedDto {
  return { ...sampleFeeds[0], id, title, account_id: "acc-1", folder_id: folderId, unread_count: 1 };
}

const initialFeeds = [
  buildFeed("feed-a1", "A one", "folder-a"),
  buildFeed("feed-a2", "A two", "folder-a"),
  buildFeed("feed-b1", "B one", "folder-b"),
  buildFeed("feed-u1", "U one", null),
];

type HarnessProps = {
  expandedFolderIds: Set<string>;
  failMove: boolean;
  settleMove?: Promise<void>;
};

function Harness({ expandedFolderIds, failMove, settleMove }: HarnessProps) {
  const [feeds, setFeeds] = useState(initialFeeds);
  const scrollRef = useRef<HTMLDivElement>(null);
  const moveFeed = async (feedId: string, folderId: string | null) => {
    setFeeds((current) => current.map((feed) => (feed.id === feedId ? { ...feed, folder_id: folderId } : feed)));
    await settleMove;
    if (failMove) {
      throw new Error("move failed");
    }
  };
  const { feedTreeProps } = useSidebarFeedSectionController({
    selectedAccountId: "acc-1",
    folderOrderMode: "name",
    feeds,
    folders,
    starredCountByFeedId: new Map(),
    selection: { type: "all" },
    viewMode: "all",
    expandedFolderIds,
    sortSubscriptions: "folders_first",
    grayscaleFavicons: false,
    isFeedsSectionOpen: true,
    startupFolderExpansion: "restore_previous",
    sidebarDensity: "normal",
    showSidebarUnread: true,
    showSidebarStarred: true,
    showSidebarRecentArticles: true,
    showSidebarTags: true,
    tags: [],
    setExpandedFolders: vi.fn(),
    selectFeed: vi.fn(),
    selectFolder: vi.fn(),
    selectAll: vi.fn(),
    selectSmartView: vi.fn(),
    setViewMode: vi.fn(),
    toggleFolder: vi.fn(),
    displayFavicons: false,
    moveFeedToFolder: (feedId, folderId) => moveFeed(feedId, folderId),
    moveFeedToUnfoldered: (feedId) => moveFeed(feedId, null),
    feedTreeScrollContainerRef: scrollRef,
  });

  return (
    <div ref={scrollRef}>
      <FeedTreeView {...feedTreeProps} emptyState={{ kind: "hidden" }} />
    </div>
  );
}

function rowOf(attribute: string, id: string): HTMLElement {
  const row = document.querySelector<HTMLElement>(`[${attribute}="${id}"]`);
  if (!row) {
    throw new Error(`row ${attribute}=${id} should be rendered`);
  }
  return row;
}

describe("feed move motion through the sidebar controller and feed tree", () => {
  const animateCalls: Array<{ target: HTMLElement; keyframes: Keyframe[] }> = [];

  beforeEach(async () => {
    await i18n.changeLanguage("en");
    animateCalls.length = 0;
    // jsdom has no layout, so a row's top follows its position in document order.
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      const rows = Array.from(document.querySelectorAll(MOTION_ROW_SELECTOR));
      const index = rows.indexOf(this);
      return new DOMRect(0, index < 0 ? 0 : index * ROW_HEIGHT, 0, ROW_HEIGHT);
    });
    Object.defineProperty(HTMLElement.prototype, "animate", {
      configurable: true,
      value: function animate(this: HTMLElement, keyframes: Keyframe[]) {
        animateCalls.push({ target: this, keyframes });
        return { cancel: vi.fn() };
      },
    });
  });

  afterEach(() => {
    cleanup();
    Reflect.deleteProperty(HTMLElement.prototype, "animate");
    vi.restoreAllMocks();
  });

  function translatedRowIds(): string[] {
    return animateCalls
      .filter((call) => JSON.stringify(call.keyframes).includes("transform"))
      .map(
        (call) =>
          call.target.getAttribute(FEED_MOVE_FEED_ROW_ATTRIBUTE) ??
          `folder:${call.target.getAttribute(FEED_MOVE_FOLDER_ROW_ATTRIBUTE)}`,
      );
  }

  async function armAndDropOnFolder(feedTitle: string, folderName: string) {
    fireEvent.click(screen.getByRole("button", { name: `Drag ${feedTitle}` }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: `Move to ${folderName}` }));
    });
    flushTestMutationObservers();
  }

  it("shifts the rows around a feed moved between open folders and fades the moved feed", async () => {
    render(<Harness expandedFolderIds={new Set(["folder-a", "folder-b"])} failMove={false} />);

    await armAndDropOnFolder("A one", "Bravo");

    expect(translatedRowIds()).toEqual(["feed-a2", "folder:folder-b"]);
    const fades = animateCalls.filter((call) => JSON.stringify(call.keyframes).includes("opacity"));
    expect(fades).toHaveLength(1);
    expect(rowOf(FEED_MOVE_FEED_ROW_ATTRIBUTE, "feed-a1").contains(fades[0].target)).toBe(true);
  });

  it("does not play a motion for a feed moved into a closed folder, only for the rows that shift", async () => {
    render(<Harness expandedFolderIds={new Set(["folder-a"])} failMove={false} />);

    await armAndDropOnFolder("A one", "Bravo");

    expect(translatedRowIds()).toEqual(["feed-a2", "folder:folder-b"]);
    expect(animateCalls.filter((call) => JSON.stringify(call.keyframes).includes("opacity"))).toHaveLength(0);
  });

  it("shifts the rows when a feed leaves its folder through the unfoldered drop zone", async () => {
    render(<Harness expandedFolderIds={new Set(["folder-a", "folder-b"])} failMove={false} />);

    fireEvent.click(screen.getByRole("button", { name: "Drag A one" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Move to no folder" }));
    });
    flushTestMutationObservers();

    expect(translatedRowIds()).toContain("feed-a2");
    expect(animateCalls.filter((call) => JSON.stringify(call.keyframes).includes("opacity"))).toHaveLength(1);
  });

  it("waits until the drag UI is gone before playing, as the optimistic update lands before the move settles", async () => {
    let settle = () => {};
    const settleMove = new Promise<void>((resolve) => {
      settle = resolve;
    });
    render(<Harness expandedFolderIds={new Set(["folder-a", "folder-b"])} failMove={false} settleMove={settleMove} />);

    fireEvent.click(screen.getByRole("button", { name: "Drag A one" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Move to Bravo" }));
    });
    flushTestMutationObservers();

    expect(screen.getByTestId("unfoldered-drop-zone")).toBeInTheDocument();
    expect(animateCalls).toHaveLength(0);

    await act(async () => {
      settle();
    });
    flushTestMutationObservers();

    expect(screen.queryByTestId("unfoldered-drop-zone")).not.toBeInTheDocument();
    expect(translatedRowIds()).toEqual(["feed-a2", "folder:folder-b"]);
  });

  it("plays no motion when the move is rejected", async () => {
    render(<Harness expandedFolderIds={new Set(["folder-a", "folder-b"])} failMove />);

    fireEvent.click(screen.getByRole("button", { name: "Drag A one" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Move to Bravo" }));
    });
    flushTestMutationObservers();

    expect(animateCalls).toHaveLength(0);
  });
});
