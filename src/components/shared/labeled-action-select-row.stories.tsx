import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { LabeledActionSelectRow } from "./labeled-action-select-row";

const meta = {
  title: "Shared/Rows/LabeledActionSelectRow",
  component: LabeledActionSelectRow,
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
    label: "Mute scope",
    name: "mute-scope",
    value: "title",
    options: [
      { value: "title", label: "Title" },
      { value: "body", label: "Body" },
    ],
    onValueChange: fn(),
  },
} satisfies Meta<typeof LabeledActionSelectRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithTrailingAction: Story = {
  args: {
    trailingControls: (
      <button type="button" className="h-10 rounded-md border border-border/65 px-4 text-sm font-medium">
        Delete
      </button>
    ),
  },
};
