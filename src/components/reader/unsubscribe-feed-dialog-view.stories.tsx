import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { UnsubscribeFeedDialogView } from "./unsubscribe-feed-dialog-view";

const meta = {
  title: "Reader/UnsubscribeFeedDialogView",
  component: UnsubscribeFeedDialogView,
  tags: ["autodocs"],
  args: {
    open: true,
    title: "Unsubscribe",
    description: (
      <>
        Are you sure you want to unsubscribe from <strong>Tech Blog</strong>? All articles from this feed will be
        deleted.
      </>
    ),
    cancelLabel: "Cancel",
    confirmLabel: "Unsubscribe",
    onOpenChange: fn(),
    onConfirm: fn(),
  },
} satisfies Meta<typeof UnsubscribeFeedDialogView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
