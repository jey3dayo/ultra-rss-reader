import type { Meta, StoryObj } from "@storybook/react-vite";
import { createRef } from "react";
import { fn } from "storybook/test";
import { AddFeedDialogView } from "./add-feed-dialog-view";

const meta = {
  title: "Reader/AddFeedDialogView",
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
        { value: "__new__", label: "New folder" },
      ],
      disabled: false,
      isCreatingFolder: false,
      newFolderLabel: "Folder name",
      newFolderName: "",
      newFolderPlaceholder: "Enter folder name",
      onValueChange: fn(),
      onNewFolderNameChange: fn(),
      newFolderInputRef: createRef<HTMLInputElement>(),
    },
    error: null,
    successMessage: "Feed detected",
    isDiscoverDisabled: false,
    isSubmitDisabled: false,
    labels: {
      title: "Add Feed",
      description: "Add a feed from a URL or website",
      urlPlaceholder: "Feed or Site URL",
      discover: "Discover",
      discovering: "Discovering",
      cancel: "Cancel",
      add: "Add",
      adding: "Adding",
    },
    inputRef: createRef<HTMLInputElement>(),
    onSubmit: fn(),
  },
} satisfies Meta<typeof AddFeedDialogView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const CreatingFolder: Story = {
  args: {
    isDiscoverDisabled: false,
    folderSelectProps: {
      labelId: "folder-story-label",
      label: "Folder",
      value: "__new__",
      options: [
        { value: "", label: "No folder" },
        { value: "folder-1", label: "Work" },
        { value: "folder-2", label: "Personal" },
        { value: "__new__", label: "New folder" },
      ],
      disabled: false,
      isCreatingFolder: true,
      newFolderLabel: "Folder name",
      newFolderName: "Reading List",
      newFolderPlaceholder: "Enter folder name",
      onValueChange: fn(),
      onNewFolderNameChange: fn(),
      newFolderInputRef: createRef<HTMLInputElement>(),
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
      labelId: "folder-story-label",
      label: "Folder",
      value: "",
      options: [
        { value: "", label: "No folder" },
        { value: "folder-1", label: "Work" },
        { value: "folder-2", label: "Personal" },
        { value: "__new__", label: "New folder" },
      ],
      disabled: true,
      isCreatingFolder: false,
      newFolderLabel: "Folder name",
      newFolderName: "",
      newFolderPlaceholder: "Enter folder name",
      onValueChange: fn(),
      onNewFolderNameChange: fn(),
      newFolderInputRef: createRef<HTMLInputElement>(),
    },
  },
};
