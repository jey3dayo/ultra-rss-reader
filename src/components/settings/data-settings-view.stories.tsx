import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { DataSettingsView } from "./data-settings-view";

const meta = {
  title: "Settings/Category/DataSettingsView",
  component: DataSettingsView,
  tags: ["autodocs"],
  args: {
    title: "Data Management",
    databaseHeading: "Database",
    databaseSizeLabel: "Database size",
    databaseSizeStatus: "ready",
    databaseSizeValue: "24.6 MB",
    databaseSizeLoadingLabel: "Loading…",
    databaseSizeErrorLabel: "Unavailable",
    safetyHeading: "Backup and restore",
    safetySummary: "Restore outside the app: quit it first and confirm the account and item count.",
    safetyDescription: "Confirm a rollback path before changing user data.",
    safetyChecklist: [
      "Use OPML export when you only need to move subscriptions.",
      "Quit the app before restoring a database backup.",
      "Before deleting or restoring data, check the account name and item count.",
    ],
    safetyInfoAriaLabel: "Show backup and restore steps",
    backupLabel: "Back up",
    backupSummary: "Save a current database copy while the app is running.",
    backupDescription: "Back up the current database to guard against corruption outside a migration.",
    backupInfoAriaLabel: "Show backup details",
    backingUp: false,
    onBackupDatabase: fn(),
    settingsProfileHeading: "Settings profile",
    settingsProfileDescription:
      "Export preferences, account skeletons, tags, and mute keywords. Accounts include any server URL and username you set, so keep the file private. Passwords and article data are not included, and this file restores neither your library nor your sign-ins.",
    settingsProfilePrivacyWarning: "Contains server URLs and usernames. Keep the file private.",
    settingsProfileInfoAriaLabel: "Show settings profile details",
    settingsProfileImportLabel: "Import profile",
    settingsProfileExportLabel: "Export profile",
    settingsProfileFileInputLabel: "Choose settings profile JSON",
    importingSettingsProfile: false,
    exportingSettingsProfile: false,
    optimizationHeading: "Optimization",
    vacuumSummary: "Reclaims unused space.",
    vacuumDescription: "Reclaim unused database space after large cleanup operations.",
    vacuumInfoAriaLabel: "Show optimization details",
    vacuumLabel: "Optimize database",
    vacuuming: false,
    logsHeading: "Logs",
    openLogDirDescription: "Open the folder that contains application logs.",
    openLogDirLabel: "Open log folder",
    openingLogDir: false,
    onVacuum: fn(),
    onOpenLogDir: fn(),
    onImportSettingsProfile: fn(),
    onExportSettingsProfile: fn(),
  },
  decorators: [
    (Story) => (
      <div className="w-full max-w-[420px] bg-background p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof DataSettingsView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Vacuuming: Story = {
  args: {
    vacuuming: true,
  },
};

export const ProfileHelpOpen: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Show settings profile details" }));
  },
};

export const BackupRestoreHelpOpen: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Show backup and restore steps" }));
  },
};

export const BackupHelpOpen: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Show backup details" }));
  },
};

export const OptimizationHelpOpen: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Show optimization details" }));
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
