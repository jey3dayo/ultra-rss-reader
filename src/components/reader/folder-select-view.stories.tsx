import type { Meta, StoryObj } from "@storybook/react-vite";
import { createRef } from "react";
import { fn } from "storybook/test";
import { FolderSelectView } from "./folder-select-view";

const meta = {
  title: "Reader/FolderSelectView",
  component: FolderSelectView,
  tags: ["autodocs"],
  args: {
    labelId: "folder-select-label",
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
  decorators: [
    (Story) => (
      <div className="w-[320px] bg-background p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof FolderSelectView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const CreatingFolder: Story = {
  args: {
    value: "__new__",
    isCreatingFolder: true,
    newFolderName: "Reading List",
  },
};
