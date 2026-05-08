import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { DataSettingsView } from "./data-settings-view";

const meta = {
  title: "Settings/Page/DataSettingsView",
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
    optimizationHeading: "Optimization",
    vacuumDescription: "Reclaim unused database space after large cleanup operations.",
    vacuumLabel: "Optimize database",
    vacuuming: false,
    logsHeading: "Logs",
    openLogDirDescription: "Open the folder that contains application logs.",
    openLogDirLabel: "Open log folder",
    onVacuum: fn(),
    onOpenLogDir: fn(),
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
