import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { denseNarrowViewportParameters } from "@/components/storybook/viewport-fixtures";
import type { FeedTreeFeedViewModel, FeedTreeFolderViewModel } from "./feed-tree.types";
import { FeedTreeView } from "./feed-tree-view";

const baseFolders: FeedTreeFolderViewModel[] = [
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
      {
        id: "feed-3",
        accountId: "acc-1",
        folderId: "folder-1",
        title: "Gamma",
        url: "https://example.com/gamma.xml",
        siteUrl: "https://example.com/gamma",
        unreadCount: 2,
        readerMode: "on",
        webPreviewMode: "off",
        isSelected: false,
        grayscaleFavicon: false,
      },
    ],
  },
];

const baseUnfolderedFeeds: FeedTreeFeedViewModel[] = [
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
];

function buildFolderSelectedArgs() {
  return {
    folders: baseFolders.map((folder) => ({
      ...folder,
      isSelected: true,
      feeds: folder.feeds.map((feed) => ({
        ...feed,
        isSelected: false,
      })),
    })),
    unfolderedFeeds: baseUnfolderedFeeds,
  };
}

const meta = {
  title: "Reader/Sidebar/FeedTreeView",
  component: FeedTreeView,
  tags: ["autodocs"],
  args: {
    isOpen: true,
    folders: baseFolders,
    unfolderedFeeds: baseUnfolderedFeeds,
    onToggleFolder: fn(),
    onSelectFeed: fn(),
    displayFavicons: true,
    emptyState: { kind: "message", message: "No feeds yet" },
    renderFolderContextMenu: fn(),
    renderFeedContextMenu: fn(),
  },
  decorators: [
    (Story) => (
      <div className="w-60 bg-sidebar p-2 text-sidebar-foreground">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof FeedTreeView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const DenseNarrowA11yState: Story = {
  parameters: denseNarrowViewportParameters,
  decorators: [
    (Story) => (
      <div className="w-[260px] bg-sidebar p-2 text-sidebar-foreground" data-testid="feed-tree-dense-smoke">
        <Story />
      </div>
    ),
  ],
  args: {
    canDragFeeds: true,
    draggedFeedId: "feed-dense-2",
    activeDropTarget: { kind: "folder", folderId: "folder-dense-2" },
    onDragStartFeed: fn(),
    onDragEnterFolder: fn(),
    onDragEnterUnfoldered: fn(),
    onDropToFolder: fn(),
    onDropToUnfoldered: fn(),
    onDragEnd: fn(),
    folders: [
      {
        id: "folder-dense-1",
        name: "Engineering and release monitoring",
        accountId: "acc-1",
        sortOrder: 0,
        unreadCount: 128,
        isExpanded: true,
        isSelected: false,
        feeds: [
          {
            id: "feed-dense-1",
            accountId: "acc-1",
            folderId: "folder-dense-1",
            title: "Long product incident reports and deploy notes",
            url: "https://example.com/incidents.xml",
            siteUrl: "https://example.com/incidents",
            unreadCount: 44,
            readerMode: "on",
            webPreviewMode: "off",
            isSelected: true,
            grayscaleFavicon: false,
          },
          {
            id: "feed-dense-2",
            accountId: "acc-1",
            folderId: "folder-dense-1",
            title: "Accessibility regression queue",
            url: "https://example.com/a11y.xml",
            siteUrl: "https://example.com/a11y",
            unreadCount: 84,
            readerMode: "on",
            webPreviewMode: "off",
            isSelected: false,
            grayscaleFavicon: true,
          },
        ],
      },
      {
        id: "folder-dense-2",
        name: "Design review inbox",
        accountId: "acc-1",
        sortOrder: 1,
        unreadCount: 7,
        isExpanded: false,
        isSelected: false,
        feeds: [],
      },
    ],
    unfolderedFeeds: [
      {
        id: "feed-dense-3",
        accountId: "acc-1",
        folderId: null,
        title: "Unsorted mobile screenshots with long titles",
        url: "https://example.com/mobile.xml",
        siteUrl: "https://example.com/mobile",
        unreadCount: 3,
        readerMode: "on",
        webPreviewMode: "off",
        isSelected: false,
        grayscaleFavicon: false,
      },
    ],
  },
};

export const SelectionPriorityReview: Story = {
  render: (args) => (
    <div className="space-y-4">
      <style>{`
        [data-story-preview="selected-hover"] [data-feed-row-id="feed-1"] [data-feed-row-selected-indicator] {
          opacity: 0 !important;
        }
        [data-story-preview="selected-hover"] [data-feed-row-id="feed-1"] .opacity-0 {
          opacity: 1 !important;
        }
        [data-story-preview="unselected-hover"] [data-feed-row-id="feed-3"] .opacity-0 {
          opacity: 1 !important;
        }
      `}</style>
      <div className="space-y-1">
        <p className="text-[11px] font-medium tracking-[0.08em] text-sidebar-foreground/40 uppercase">Selected idle</p>
        <div className="rounded-md border border-[var(--feed-tree-review-frame-border)] bg-[var(--feed-tree-review-frame-surface)] p-2">
          <FeedTreeView {...args} />
        </div>
      </div>
      <div className="space-y-1">
        <p className="text-[11px] font-medium tracking-[0.08em] text-sidebar-foreground/40 uppercase">
          Selected hover priority
        </p>
        <div
          className="rounded-md border border-[var(--feed-tree-review-frame-border)] bg-[var(--feed-tree-review-frame-surface)] p-2"
          data-story-preview="selected-hover"
        >
          <FeedTreeView {...args} canDragFeeds={true} />
        </div>
      </div>
      <div className="space-y-1">
        <p className="text-[11px] font-medium tracking-[0.08em] text-sidebar-foreground/40 uppercase">
          Unselected hover
        </p>
        <div
          className="rounded-md border border-[var(--feed-tree-review-frame-border)] bg-[var(--feed-tree-review-frame-surface)] p-2"
          data-story-preview="unselected-hover"
        >
          <FeedTreeView {...args} canDragFeeds={true} />
        </div>
      </div>
    </div>
  ),
};

export const FolderSelectionReview: Story = {
  render: (args) => {
    const folderSelectedArgs = buildFolderSelectedArgs();

    return (
      <div className="space-y-4">
        <div className="space-y-1">
          <p className="text-[11px] font-medium tracking-[0.08em] text-sidebar-foreground/40 uppercase">
            Folder selected
          </p>
          <div className="rounded-md border border-[var(--feed-tree-review-frame-border)] bg-[var(--feed-tree-review-frame-surface)] p-2">
            <FeedTreeView {...args} {...folderSelectedArgs} />
          </div>
        </div>
      </div>
    );
  },
};

export const DragEnabled: Story = {
  args: {
    canDragFeeds: true,
    draggedFeedId: null,
    activeDropTarget: null,
    onDragStartFeed: fn(),
    onDragEnterFolder: fn(),
    onDragEnterUnfoldered: fn(),
    onDropToFolder: fn(),
    onDropToUnfoldered: fn(),
    onDragEnd: fn(),
  },
};

export const Empty: Story = {
  args: {
    folders: [],
    unfolderedFeeds: [],
    emptyState: { kind: "action", label: "Add account", onAction: fn() },
  },
};

export const EmptyFolderTarget: Story = {
  args: {
    canDragFeeds: true,
    draggedFeedId: null,
    activeDropTarget: null,
    onDragStartFeed: fn(),
    onDragEnterFolder: fn(),
    onDragEnterUnfoldered: fn(),
    onDropToFolder: fn(),
    onDropToUnfoldered: fn(),
    onDragEnd: fn(),
    folders: [
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
    ],
  },
};

export const ActiveUnfolderedTarget: Story = {
  args: {
    canDragFeeds: true,
    draggedFeedId: "feed-1",
    activeDropTarget: { kind: "unfoldered" },
    onDragStartFeed: fn(),
    onDragEnterFolder: fn(),
    onDragEnterUnfoldered: fn(),
    onDropToFolder: fn(),
    onDropToUnfoldered: fn(),
    onDragEnd: fn(),
  },
};
