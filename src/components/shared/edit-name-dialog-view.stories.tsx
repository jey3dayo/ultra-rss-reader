import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { EditNameDialogView } from "./edit-name-dialog-view";

const meta = {
  title: "Shared/Dialogs/EditNameDialogView",
  component: EditNameDialogView,
  tags: ["autodocs"],
  args: {
    open: true,
    title: "Rename folder",
    nameLabel: "Name",
    inputName: "folder-name",
    name: "Work",
    loading: false,
    cancelLabel: "Cancel",
    submitLabel: "Save",
    submittingLabel: "Saving…",
    onOpenChange: fn(),
    onNameChange: fn(),
    onSubmit: fn(),
  },
} satisfies Meta<typeof EditNameDialogView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FolderRename: Story = {};

export const Loading: Story = {
  args: {
    loading: true,
  },
};
