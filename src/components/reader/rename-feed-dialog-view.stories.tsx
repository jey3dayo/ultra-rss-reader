import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { RenameFeedDialogView } from "./rename-feed-dialog-view";

const meta = {
  title: "Reader/RenameFeedDialogView",
  component: RenameFeedDialogView,
  tags: ["autodocs"],
  args: {
    open: true,
    title: "Tech Blog",
    loading: false,
    displayMode: "normal",
    displayModeOptions: [
      { value: "normal", label: "Normal" },
      { value: "widescreen", label: "Widescreen" },
    ],
    folderSelectProps: {
      labelId: "folder-story-label",
      label: "Folder",
      value: "folder-1",
      options: [
        { value: "", label: "No folder" },
        { value: "folder-1", label: "Work" },
        { value: "folder-2", label: "Personal" },
      ],
      disabled: false,
      isCreatingFolder: false,
      newFolderLabel: "Folder name",
      newFolderName: "",
      newFolderPlaceholder: "Enter folder name",
      onValueChange: fn(),
      onNewFolderNameChange: fn(),
    },
    labels: {
      title: "Edit Feed",
      titleField: "Title",
      displayMode: "Display Mode",
      cancel: "Cancel",
      save: "Save",
      saving: "Saving",
    },
    onOpenChange: fn(),
    onTitleChange: fn(),
    onDisplayModeChange: fn(),
    onSubmit: fn(),
  },
} satisfies Meta<typeof RenameFeedDialogView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Loading: Story = {
  args: {
    loading: true,
  },
};
