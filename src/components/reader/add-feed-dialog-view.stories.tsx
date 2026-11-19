import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { AddFeedDialogView } from "./add-feed-dialog-view";

const meta = {
  title: "Reader/Dialog/AddFeedDialogView",
  component: AddFeedDialogView,
  tags: ["autodocs"],
  args: {
    open: true,
    onOpenChange: fn(),
    url: "https://example.com",
    onUrlChange: fn(),
    onDiscover: fn(),
    discovering: false,
    loading: false,
    discoveredFeedsFoundLabel: "Found 2 feeds",
    discoveredFeedOptions: [
      { value: "https://example.com/feed.xml", label: "Tech Blog" },
      { value: "https://example.com/atom.xml", label: "News Feed" },
    ],
    selectedFeedUrl: "https://example.com/feed.xml",
    onSelectedFeedUrlChange: fn(),
    folderSelectProps: {
      labelId: "folder-story-label",
      label: "Folder",
      value: "",
      options: [
        { value: "", label: "No folder" },
        { value: "folder-1", label: "Work" },
        { value: "folder-2", label: "Personal" },
      ],
      canCreateFolder: true,
      disabled: false,
      isCreatingFolder: false,
      newFolderOptionLabel: "New folder",
      newFolderLabel: "Folder name",
      newFolderName: "",
      newFolderPlaceholder: "Enter folder name",
      onValueChange: fn(),
      onNewFolderNameChange: fn(),
    },
    error: null,
    successMessage: "Feed detected",
    urlHint: null,
    urlHintTone: "muted",
    isDiscoverDisabled: false,
    isSubmitDisabled: false,
    labels: {
      title: "Add feed",
      description: "Add a feed from a URL or website",
      account: "Add to: Personal RSS",
      urlLabel: "Feed",
      urlPlaceholder: "https://example.com/feed.xml",
      discover: "Discover",
      discovering: "Discovering",
      cancel: "Cancel",
      add: "Add",
      adding: "Adding",
    },
    onSubmit: fn(),
  },
} satisfies Meta<typeof AddFeedDialogView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const CreatingFolder: Story = {
  args: {
    folderSelectProps: {
      ...meta.args.folderSelectProps,
      value: "__new__",
      isCreatingFolder: true,
      newFolderName: "Reading List",
    },
    successMessage: null,
  },
};

export const Loading: Story = {
  args: {
    loading: true,
    isDiscoverDisabled: true,
    isSubmitDisabled: true,
    folderSelectProps: {
      ...meta.args.folderSelectProps,
      disabled: true,
    },
  },
};

export const InvalidUrl: Story = {
  args: {
    url: "example.com",
    urlHint: "Use a full URL like https://example.com",
    urlHintTone: "error",
    successMessage: null,
    isDiscoverDisabled: true,
    isSubmitDisabled: true,
  },
};
