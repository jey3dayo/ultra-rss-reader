import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { RenameTagDialogView } from "./rename-tag-dialog-view";

const meta = {
  title: "Reader/Dialog/RenameTagDialogView",
  component: RenameTagDialogView,
  tags: ["autodocs"],
  args: {
    open: true,
    name: "Work",
    color: null,
    loading: false,
    onColorChange: fn(),
    colorOptions: ["#cf7868", "#6f8eb8", "#5f9670"],
    noColorLabel: "No color",
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
