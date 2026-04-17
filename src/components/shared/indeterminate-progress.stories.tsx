import type { Meta, StoryObj } from "@storybook/react-vite";
import { IndeterminateProgress } from "./indeterminate-progress";

const meta = {
  title: "Shared/Feedback/IndeterminateProgress",
  component: IndeterminateProgress,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Indeterminate loading bar for settings, startup, and compact toolbar progress surfaces. Uses the shared loading semantic tone instead of the warm ring accent.",
      },
    },
  },
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
    <div className="w-full overflow-hidden rounded-xl border border-border/50 bg-browser-overlay-shell shadow-elevation-2">
      <div className="border-b border-browser-overlay-rail-border px-4 py-3 text-sm text-foreground-soft">
        Loading preview
      </div>
      <IndeterminateProgress {...args} />
      <div className="px-4 py-5 text-xs text-foreground-soft">
        Top-bar loading indicator on a shell-grade dark toolbar surface.
      </div>
    </div>
  ),
};
