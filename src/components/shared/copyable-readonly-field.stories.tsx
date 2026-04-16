import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { CopyableReadonlyField } from "./copyable-readonly-field";

const meta = {
  title: "Shared/CopyableReadonlyField",
  component: CopyableReadonlyField,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  decorators: [
    (Story) => (
      <div className="max-w-md">
        <Story />
      </div>
    ),
  ],
  args: {
    label: "Feed URL",
    name: "feed-url",
    value: "https://example.com/feed.xml",
    copyLabel: "Copy feed URL",
    onCopy: fn(),
  },
} satisfies Meta<typeof CopyableReadonlyField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const EmptyValue: Story = {
  args: {
    value: "",
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
  },
};
