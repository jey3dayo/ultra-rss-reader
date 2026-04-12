import type { Meta, StoryObj } from "@storybook/react-vite";
import { AlertTriangle, CheckCheck } from "lucide-react";
import { fn } from "storybook/test";
import { ConfirmDialogView } from "./confirm-dialog-view";

const meta = {
  title: "Shared/ConfirmDialogView",
  component: ConfirmDialogView,
  tags: ["autodocs"],
  args: {
    open: true,
    title: "Confirm",
    message: "Delete this feed?",
    actionLabel: "Delete",
    cancelLabel: "Cancel",
    onOpenChange: fn(),
    onConfirm: fn(),
    onCancel: fn(),
  },
} satisfies Meta<typeof ConfirmDialogView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const SuccessTone: Story = {
  args: {
    message: "Mark all selected articles as read?",
    actionLabel: "Mark all read",
    icon: CheckCheck,
  },
};

export const WarningTone: Story = {
  args: {
    message: "This action cannot be undone.",
    actionLabel: "Continue",
    icon: AlertTriangle,
  },
};
