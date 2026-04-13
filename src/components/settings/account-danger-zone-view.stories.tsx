import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { AccountDangerZoneView } from "./account-danger-zone-view";

const meta = {
  title: "Settings/AccountDangerZoneView",
  component: AccountDangerZoneView,
  tags: ["autodocs"],
  args: {
    exportLabel: "Export OPML",
    deleteLabel: "Delete account",
    cancelLabel: "Cancel",
    confirmDeleteLabel: "This action cannot be undone.",
    isConfirmingDelete: false,
    onExport: fn(),
    onRequestDelete: fn(),
    onConfirmDelete: fn(),
    onCancelDelete: fn(),
  },
  decorators: [
    (Story) => (
      <div className="w-full max-w-[420px] bg-background p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AccountDangerZoneView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const ConfirmingDelete: Story = {
  args: {
    isConfirmingDelete: true,
    deleteLabel: "Delete",
  },
};
