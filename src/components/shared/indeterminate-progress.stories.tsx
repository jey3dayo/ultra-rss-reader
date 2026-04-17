import type { Meta, StoryObj } from "@storybook/react-vite";
import { IndeterminateProgress } from "./indeterminate-progress";

const meta = {
  title: "Shared/IndeterminateProgress",
  component: IndeterminateProgress,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="w-full max-w-[420px] p-8">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof IndeterminateProgress>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const ToolbarPreview: Story = {
  render: (args) => (
    <div className="w-full overflow-hidden rounded-xl border border-border/40 bg-[#211d18] shadow-elevation-2">
      <div className="border-b border-white/8 px-4 py-3 text-sm text-white/72">Loading preview</div>
      <IndeterminateProgress {...args} />
      <div className="px-4 py-5 text-xs text-white/44">Top-bar loading indicator on a dark toolbar surface.</div>
    </div>
  ),
};
