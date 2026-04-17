import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { DestructiveDialogFooter } from "./destructive-dialog-footer";

const meta = {
  title: "Shared/Dialogs/DestructiveDialogFooter",
  component: DestructiveDialogFooter,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Footer actions for destructive dialogs. The surrounding rounded frame in this story is a shell example, not a section/card specimen.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="max-w-md rounded-2xl border border-border bg-surface-1 p-4 shadow-elevation-1">
        <Story />
      </div>
    ),
  ],
  args: {
    cancelLabel: "Cancel",
    confirmLabel: "Delete",
    onCancel: fn(),
    onConfirm: fn(),
  },
} satisfies Meta<typeof DestructiveDialogFooter>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Pending: Story = {
  args: {
    pending: true,
  },
};

export const LongConfirmLabel: Story = {
  args: {
    confirmLabel: "Remove account permanently",
  },
};
