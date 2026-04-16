import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { LabeledSelectRow } from "./labeled-select-row";

const meta = {
  title: "Shared/LabeledSelectRow",
  component: LabeledSelectRow,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  decorators: [
    (Story) => (
      <div className="max-w-xl">
        <Story />
      </div>
    ),
  ],
  args: {
    label: "Account type",
    name: "account-type",
    value: "freshrss",
    options: [
      { value: "freshrss", label: "FreshRSS" },
      { value: "feedbin", label: "Feedbin" },
      { value: "inoreader", label: "Inoreader" },
    ],
    onChange: fn(),
  },
} satisfies Meta<typeof LabeledSelectRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Open: Story = {
  args: {
    open: true,
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
  },
};
