import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ReactNode } from "react";
import { fn } from "storybook/test";
import type { FeedTreeFeedViewModel, FeedTreeFolderViewModel } from "./feed-tree.types";
import { FeedTreeView } from "./feed-tree-view";
import type { SidebarTagItem } from "./sidebar-tag-items.types";
import { SmartViewsView } from "./smart-views-view";
import { TagListView } from "./tag-list-view";

const reviewFolders: FeedTreeFolderViewModel[] = [
  {
    id: "folder-1",
    name: "Comic",
    accountId: "acc-1",
    sortOrder: 0,
    unreadCount: 9275,
    isExpanded: true,
    isSelected: false,
    feeds: [
      {
        id: "feed-1",
        accountId: "acc-1",
        folderId: "folder-1",
        title: "連載サンプルA",
        url: "https://example.com/sample-a.xml",
        siteUrl: "https://example.com/sample-a",
        unreadCount: 146,
        readerMode: "on",
        webPreviewMode: "off",
        isSelected: true,
        grayscaleFavicon: false,
      },
      {
        id: "feed-2",
        accountId: "acc-1",
        folderId: "folder-1",
        title: "連載サンプルB",
        url: "https://example.com/sample-b.xml",
        siteUrl: "https://example.com/sample-b",
        unreadCount: 33,
        readerMode: "on",
        webPreviewMode: "off",
        isSelected: false,
        grayscaleFavicon: false,
      },
    ],
  },
];

const reviewUnfolderedFeeds: FeedTreeFeedViewModel[] = [
  {
    id: "feed-3",
    accountId: "acc-1",
    folderId: null,
    title: "連載サンプルC",
    url: "https://example.com/sample-c.xml",
    siteUrl: "https://example.com/sample-c",
    unreadCount: 12,
    readerMode: "on",
    webPreviewMode: "off",
    isSelected: false,
    grayscaleFavicon: false,
  },
];

const folderSelectedArgs = {
  folders: reviewFolders.map((folder) => ({
    ...folder,
    isSelected: true,
    feeds: folder.feeds.map((feed) => ({
      ...feed,
      isSelected: false,
    })),
  })),
  unfolderedFeeds: reviewUnfolderedFeeds,
};

const smartViewsUnreadSelected = [
  { kind: "unread" as const, label: "未読", count: 11855, showCount: true, isSelected: true },
  { kind: "starred" as const, label: "スター", count: 0, showCount: false, isSelected: false },
];

const smartViewsStarredSelected = [
  { kind: "unread" as const, label: "未読", count: 11855, showCount: true, isSelected: false },
  { kind: "starred" as const, label: "スター", count: 28, showCount: true, isSelected: true },
];

const reviewTags: SidebarTagItem[] = [
  { id: "tag-1", name: "Fav", color: "#caa75e", articleCount: 8, isSelected: false },
  { id: "tag-2", name: "Gray", color: "#8d857e", articleCount: 1, isSelected: false },
  { id: "tag-3", name: "Red", color: "#eb8a72", articleCount: 3, isSelected: true },
];

function ReviewCard(props: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-1">
      <p className="text-[11px] font-medium tracking-[0.08em] text-sidebar-foreground/55 uppercase">{props.title}</p>
      <div className="rounded-md border border-sidebar-border/40 bg-sidebar p-2">{props.children}</div>
    </section>
  );
}

export function SidebarSelectionReviewCanvas() {
  return (
    <div className="space-y-4">
      <style>{`
        [data-story-preview="feed-selected-hover"] [data-feed-row-id="feed-1"] [data-feed-row-selected-indicator] {
          opacity: 0 !important;
        }
        [data-story-preview="feed-selected-hover"] [data-feed-row-id="feed-1"] .opacity-0 {
          opacity: 1 !important;
        }
      `}</style>

      <ReviewCard title="Smart View / Unread Selected">
        <SmartViewsView views={smartViewsUnreadSelected} onSelectSmartView={fn()} />
      </ReviewCard>

      <ReviewCard title="Smart View / Starred Selected">
        <SmartViewsView views={smartViewsStarredSelected} onSelectSmartView={fn()} />
      </ReviewCard>

      <ReviewCard title="Folder Selected">
        <FeedTreeView
          isOpen={true}
          folders={folderSelectedArgs.folders}
          unfolderedFeeds={folderSelectedArgs.unfolderedFeeds}
          onToggleFolder={fn()}
          onSelectFolder={fn()}
          onSelectFeed={fn()}
          displayFavicons={true}
          emptyState={{ kind: "message", message: "No feeds yet" }}
          renderFolderContextMenu={fn()}
          renderFeedContextMenu={fn()}
        />
      </ReviewCard>

      <ReviewCard title="Feed Selected / Idle">
        <FeedTreeView
          isOpen={true}
          folders={reviewFolders}
          unfolderedFeeds={reviewUnfolderedFeeds}
          onToggleFolder={fn()}
          onSelectFolder={fn()}
          onSelectFeed={fn()}
          displayFavicons={true}
          emptyState={{ kind: "message", message: "No feeds yet" }}
          renderFolderContextMenu={fn()}
          renderFeedContextMenu={fn()}
          canDragFeeds={true}
        />
      </ReviewCard>

      <ReviewCard title="Feed Selected / Hover Priority">
        <div data-story-preview="feed-selected-hover">
          <FeedTreeView
            isOpen={true}
            folders={reviewFolders}
            unfolderedFeeds={reviewUnfolderedFeeds}
            onToggleFolder={fn()}
            onSelectFolder={fn()}
            onSelectFeed={fn()}
            displayFavicons={true}
            emptyState={{ kind: "message", message: "No feeds yet" }}
            renderFolderContextMenu={fn()}
            renderFeedContextMenu={fn()}
            canDragFeeds={true}
          />
        </div>
      </ReviewCard>

      <ReviewCard title="Tag Selected">
        <TagListView
          tagsLabel="タグ"
          isOpen={true}
          onToggleOpen={fn()}
          tags={reviewTags}
          onSelectTag={fn()}
          renderContextMenu={fn()}
          renderTagSectionContextMenu={fn()}
        />
      </ReviewCard>
    </div>
  );
}

const meta = {
  title: "Reader/SidebarSelectionReview",
  component: SidebarSelectionReviewCanvas,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="w-80 bg-sidebar p-2 text-sidebar-foreground">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SidebarSelectionReviewCanvas>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
