import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { AccountSyncSectionView } from "./account-sync-section-view";

const syncIntervalOptions = [
  { value: "900", label: "Every 15 minutes" },
  { value: "3600", label: "Every hour" },
  { value: "7200", label: "Every 2 hours" },
];

const keepReadItemsOptions = [
  { value: "30", label: "One month" },
  { value: "90", label: "Three months" },
  { value: "0", label: "Forever" },
];

const meta = {
  title: "Settings/Section/AccountSyncSectionView",
  component: AccountSyncSectionView,
  tags: ["autodocs"],
  args: {
    heading: "Syncing",
    syncInterval: {
      name: "sync-interval",
      label: "Sync",
      value: "3600",
      options: syncIntervalOptions,
      onChange: fn(),
    },
    syncOnStartup: {
      label: "Sync on startup",
      checked: true,
      onChange: fn(),
    },
    syncOnWake: {
      label: "Sync on wake",
      checked: true,
      onChange: fn(),
    },
    keepReadItems: {
      name: "keep-read-items",
      label: "Keep read items",
      value: "30",
      options: keepReadItemsOptions,
      onChange: fn(),
    },
  },
  decorators: [
    (Story) => (
      <div className="w-full max-w-[420px] bg-background p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AccountSyncSectionView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const ForeverRetention: Story = {
  args: {
    keepReadItems: {
      name: "keep-read-items",
      label: "Keep read items",
      value: "0",
      options: keepReadItemsOptions,
      onChange: fn(),
    },
  },
};
