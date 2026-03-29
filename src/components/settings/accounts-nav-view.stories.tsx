import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { AccountsNavView } from "./accounts-nav-view";

const accounts = [
  { id: "acc-1", name: "Local", kind: "local", isActive: true },
  { id: "acc-2", name: "FreshRSS", kind: "freshrss", isActive: false },
];

const meta = {
  title: "Settings/AccountsNavView",
  component: AccountsNavView,
  tags: ["autodocs"],
  args: {
    accounts,
    addAccountLabel: "Add account...",
    isAddAccountActive: false,
    onSelectAccount: fn(),
    onAddAccount: fn(),
  },
  decorators: [
    (Story) => (
      <div className="w-[260px] bg-sidebar p-2 text-sidebar-foreground">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AccountsNavView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const AddAccountActive: Story = {
  args: {
    accounts: accounts.map((account) => ({ ...account, isActive: false })),
    isAddAccountActive: true,
  },
};
