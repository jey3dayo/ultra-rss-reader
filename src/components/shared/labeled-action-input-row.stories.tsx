import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { LabeledActionInputRow } from "./labeled-action-input-row";

const meta = {
  title: "Shared/Rows/LabeledActionInputRow",
  component: LabeledActionInputRow,
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
    label: "Tag name",
    name: "tag-name",
    value: "News",
    onChange: fn(),
  },
} satisfies Meta<typeof LabeledActionInputRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithTrailingAction: Story = {
  args: {
    trailingControls: (
      <button type="button" className="h-10 rounded-md border border-border/65 px-4 text-sm font-medium">
        Create
      </button>
    ),
  },
};
