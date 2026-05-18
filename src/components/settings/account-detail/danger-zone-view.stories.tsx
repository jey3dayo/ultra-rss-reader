import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { AccountDangerZoneView } from "./danger-zone-view";

const meta = {
  title: "Settings/Section/AccountDangerZoneView",
  component: AccountDangerZoneView,
  tags: ["autodocs"],
  args: {
    dataHeading: "Data",
    dangerHeading: "Danger Zone",
    importLabel: "Import OPML",
    exportLabel: "Export OPML",
    deleteLabel: "Delete account",
    onImport: fn(),
    onExport: fn(),
    onRequestDelete: fn(),
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
