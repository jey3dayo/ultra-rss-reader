import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { RenameTagDialogView } from "./rename-tag-dialog-view";

const meta = {
  title: "Reader/RenameTagDialogView",
  component: RenameTagDialogView,
  tags: ["autodocs"],
  args: {
    open: true,
    name: "Work",
    loading: false,
    onOpenChange: fn(),
    onNameChange: fn(),
    onSubmit: fn(),
  },
} satisfies Meta<typeof RenameTagDialogView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Loading: Story = {
  args: {
    loading: true,
  },
};
