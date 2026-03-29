import type { Meta, StoryObj } from "@storybook/react-vite";
import { createRef } from "react";
import { fn } from "storybook/test";
import type { AccountDto } from "@/api/tauri-commands";
import { AccountSwitcherView } from "./account-switcher-view";

const sampleAccounts: AccountDto[] = [
  {
    id: "acc-1",
    kind: "local",
    name: "Local",
    server_url: null,
    sync_interval_secs: 3600,
    sync_on_wake: false,
    keep_read_items_days: 30,
  },
  {
    id: "acc-2",
    kind: "freshrss",
    name: "FreshRSS",
    server_url: "https://freshrss.example.com",
    sync_interval_secs: 3600,
    sync_on_wake: false,
    keep_read_items_days: 30,
  },
];

const meta = {
  title: "Reader/AccountSwitcherView",
  component: AccountSwitcherView,
  tags: ["autodocs"],
  args: {
    title: "Ultra RSS",
    accounts: sampleAccounts,
    selectedAccountId: "acc-1",
    isExpanded: false,
    menuId: "account-switcher-menu",
    menuLabel: "Accounts",
    triggerRef: createRef<HTMLButtonElement>(),
    itemRefs: { current: [] as Array<HTMLButtonElement | null> },
    onToggle: fn(),
    onSelectAccount: fn(),
    onClose: fn(),
  },
  decorators: [
    (Story) => (
      <div className="w-[280px] bg-sidebar text-sidebar-foreground">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AccountSwitcherView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Collapsed: Story = {};

export const Expanded: Story = {
  args: {
    isExpanded: true,
  },
};

export const SingleAccount: Story = {
  args: {
    accounts: [sampleAccounts[0]],
    isExpanded: false,
  },
};
