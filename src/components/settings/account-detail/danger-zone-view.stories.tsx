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
    localSyncHeading: "Local sync folder",
    localSyncSummary: "Sync files contain subscription and article URLs plus article state.",
    localSyncDescription:
      "Stores private subscription URLs, article URLs, tags, read state, and star state as Ultra RSS Reader operation files. It never writes the SQLite database, WAL/SHM files, or credentials.",
    localSyncInfoAriaLabel: "Show local sync folder details",
    localSyncEnabledLabel: "Sync automatically",
    localSyncEnabledDescription: "Import and export run automatically every time this account syncs.",
    localSyncEnabledSummary: "Runs automatically when this account syncs.",
    localSyncEnabledInfoAriaLabel: "Show automatic sync details",
    localSyncEnabledChecked: true,
    onLocalSyncEnabledChange: fn(),
    localSyncFolderLabel: "Folder path",
    localSyncFolderPlaceholder: "/Users/alice/Sync/UltraRSSReader/local-accounts/main",
    localSyncFolderValue: "/Users/alice/Sync/UltraRSSReader/local-accounts/main",
    onLocalSyncFolderChange: fn(),
    saveLocalSyncFolderLabel: "Save Folder",
    exportLocalSyncLabel: "Write Operations",
    importLocalSyncLabel: "Read Operations",
    onSaveLocalSyncFolder: fn(),
    onExportLocalSync: fn(),
    onImportLocalSync: fn(),
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

export const LocalSyncHelpOpen: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Show local sync folder details" }));
  },
};

export const Narrow: Story = {
  decorators: [
    (Story) => (
      <div className="w-full max-w-[320px] bg-background p-3">
        <Story />
      </div>
    ),
  ],
};
