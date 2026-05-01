import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { CreateTagDialogView } from "./create-tag-dialog-view";

const meta = {
  title: "Reader/Dialog/CreateTagDialogView",
  component: CreateTagDialogView,
  tags: ["autodocs"],
  args: {
    open: true,
    name: "Research",
    loading: false,
    onOpenChange: fn(),
    onNameChange: fn(),
    onSubmit: fn(),
  },
} satisfies Meta<typeof CreateTagDialogView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const EmptyName: Story = {
  args: {
    name: "",
  },
};

export const Loading: Story = {
  args: {
    loading: true,
  },
};
