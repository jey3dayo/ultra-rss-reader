import type { Meta, StoryObj } from "@storybook/react-vite";
import { AlertTriangle, CheckCheck } from "lucide-react";
import { fn } from "storybook/test";
import enReader from "@/locales/en/reader.json";
import jaReader from "@/locales/ja/reader.json";
import { ConfirmDialogView } from "./confirm-dialog-view";

const meta = {
  title: "Shared/Dialogs/ConfirmDialogView",
  component: ConfirmDialogView,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
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
    variant: "warning",
    icon: AlertTriangle,
  },
};

export const DestructiveWithHold: Story = {
  args: {
    title: "Delete feed",
    message: "This action cannot be undone.",
    actionLabel: "Delete",
    actionAccessibleLabel: "Delete this feed. This action cannot be undone.",
    variant: "destructive",
    holdHint: "Press and hold to confirm",
  },
};

export const JapaneseFeedCount: Story = {
  args: {
    title: "既読にする",
    message: "105件の日本語フィードを既読にしますか？",
    actionLabel: "既読にする",
    cancelLabel: "キャンセル",
    variant: "warning",
    icon: AlertTriangle,
  },
};

export const LongCopy: Story = {
  args: {
    title: "Apply bulk update",
    message:
      "Apply this change to every selected article? Existing article state is kept, but the update cannot be reversed in a single step.",
    actionLabel: "Apply update",
  },
};

export const PrivateLinkWarning: Story = {
  args: {
    title: enReader.reader_link_private_open,
    message: enReader.reader_link_private_confirm.replace("{{host}}", "192.168.1.20"),
    actionLabel: enReader.reader_link_private_open,
    variant: "warning",
    icon: AlertTriangle,
  },
};

export const PrivateLinkWarningJapanese: Story = {
  args: {
    title: jaReader.reader_link_private_open,
    message: jaReader.reader_link_private_confirm.replace("{{host}}", "localhost"),
    actionLabel: jaReader.reader_link_private_open,
    cancelLabel: "キャンセル",
    variant: "warning",
    icon: AlertTriangle,
  },
};
