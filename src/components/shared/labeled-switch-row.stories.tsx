import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { LabeledSwitchRow } from "./labeled-switch-row";

const meta = {
  title: "Shared/LabeledSwitchRow",
  component: LabeledSwitchRow,
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
    label: "Open links in background",
    checked: false,
    onChange: fn(),
  },
} satisfies Meta<typeof LabeledSwitchRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Off: Story = {};

export const On: Story = {
  args: {
    checked: true,
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
  },
};
