import type { Meta, StoryObj } from "@storybook/react-vite";
import { RotateCcw } from "lucide-react";
import { fn } from "storybook/test";
import { LabeledInputRow } from "./labeled-input-row";

const meta = {
  title: "Shared/LabeledInputRow",
  component: LabeledInputRow,
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
    label: "Server URL",
    name: "server-url",
    value: "https://example.com/rss",
    onChange: fn(),
  },
} satisfies Meta<typeof LabeledInputRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const InlineAction: Story = {
  args: {
    actionLabel: "Reset",
    onAction: fn(),
  },
};

export const InsideIconAction: Story = {
  args: {
    label: "Username",
    name: "username",
    value: "ultra-reader",
    actionLabel: "Reset username",
    actionAriaLabel: "Reset username",
    actionTooltipLabel: "Reset username",
    actionIcon: <RotateCcw />,
    actionPlacement: "inside",
    actionVariant: "ghost",
    actionSize: "icon-sm",
    onAction: fn(),
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
    actionLabel: "Reset",
    onAction: fn(),
    actionDisabled: true,
  },
};
