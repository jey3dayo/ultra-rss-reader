import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { StackedInputField } from "./stacked-input-field";

const meta = {
  title: "Shared/StackedInputField",
  component: StackedInputField,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="w-full max-w-[320px] bg-background p-4">
        <Story />
      </div>
    ),
  ],
  args: {
    label: "Feed title",
    name: "feed-title",
    value: "Ultra RSS",
    onChange: fn(),
  },
} satisfies Meta<typeof StackedInputField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Disabled: Story = {
  args: {
    disabled: true,
  },
};
