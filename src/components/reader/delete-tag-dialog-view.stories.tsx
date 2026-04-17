import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { DeleteTagDialogView } from "./delete-tag-dialog-view";

const meta = {
  title: "Reader/Dialog/DeleteTagDialogView",
  component: DeleteTagDialogView,
  tags: ["autodocs"],
  args: {
    open: true,
    tagName: "Work",
    onOpenChange: fn(),
    onConfirm: fn(),
  },
} satisfies Meta<typeof DeleteTagDialogView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
