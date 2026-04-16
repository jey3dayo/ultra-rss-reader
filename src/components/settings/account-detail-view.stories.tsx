import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { AccountDetailView } from "./account-detail-view";

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
  title: "Settings/AccountDetailView",
  component: AccountDetailView,
  tags: ["autodocs"],
  args: {
    title: "Personal FreshRSS",
    subtitle: "FreshRSS",
    generalSection: {
      heading: "General",
      nameLabel: "Description",
      nameValue: "Personal FreshRSS",
      editNameTitle: "Click to edit",
      isEditingName: false,
      nameDraft: "Personal FreshRSS",
      infoRows: [
        { label: "Type", value: "FreshRSS" },
        { label: "Server", value: "https://freshrss.example.com", truncate: true },
      ],
      onStartEditingName: fn(),
      onNameDraftChange: fn(),
      onCommitName: fn(),
      onNameKeyDown: fn(),
    },
    syncSection: {
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
      statusRows: [
        { label: "Next automatic retry", value: "Apr 13, 12:15" },
        { label: "Last sync error", value: "Network timeout while contacting FreshRSS" },
      ],
    },
    dangerZone: {
      dataHeading: "Data",
      dangerHeading: "Danger Zone",
      exportLabel: "Export OPML",
      deleteLabel: "Delete account",
      onExport: fn(),
      onRequestDelete: fn(),
    },
  },
  decorators: [
    (Story) => (
      <div className="w-full max-w-[480px] bg-background p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AccountDetailView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const ConfirmingDelete: Story = {
  args: {
    dangerZone: {
      dataHeading: "Data",
      dangerHeading: "Danger Zone",
      exportLabel: "Export OPML",
      deleteLabel: "Delete",
      onExport: fn(),
      onRequestDelete: fn(),
    },
  },
};
