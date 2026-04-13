import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { StackedSelectField } from "./stacked-select-field";

const meta = {
  title: "Shared/StackedSelectField",
  component: StackedSelectField,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="w-full max-w-[320px] bg-background p-4">
        <Story />
      </div>
    ),
  ],
  args: {
    label: "Display mode",
    name: "display-mode",
    value: "preview",
    options: [
      { value: "default", label: "Default" },
      { value: "preview", label: "Web Preview" },
      { value: "reader", label: "Reader" },
    ],
    onChange: fn(),
  },
} satisfies Meta<typeof StackedSelectField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Disabled: Story = {
  args: {
    disabled: true,
  },
};
