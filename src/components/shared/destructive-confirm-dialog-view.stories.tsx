import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { DestructiveConfirmDialogView } from "./destructive-confirm-dialog-view";

const meta = {
  title: "Shared/Dialogs/DestructiveConfirmDialogView",
  component: DestructiveConfirmDialogView,
  tags: ["autodocs"],
  args: {
    open: true,
    title: "Delete feed",
    description: "This action cannot be undone.",
    cancelLabel: "Cancel",
    confirmLabel: "Delete",
    onOpenChange: fn(),
    onConfirm: fn(),
  },
} satisfies Meta<typeof DestructiveConfirmDialogView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Pending: Story = {
  args: {
    pending: true,
  },
};

export const LongCopy: Story = {
  args: {
    title: "Remove account",
    description:
      "Removing this account also clears local sync state for its feeds and articles. You will need to add the account again to resume syncing.",
    confirmLabel: "Remove account",
  },
};
