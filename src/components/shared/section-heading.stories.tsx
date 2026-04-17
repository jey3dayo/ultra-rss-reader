import type { Meta, StoryObj } from "@storybook/react-vite";
import { SectionHeading } from "./section-heading";

const meta = {
  title: "Shared/Layout/SectionHeading",
  component: SectionHeading,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  decorators: [
    (Story) => (
      <div className="max-w-sm rounded-lg border border-border bg-surface-1 p-4">
        <Story />
      </div>
    ),
  ],
  args: {
    children: "General",
  },
} satisfies Meta<typeof SectionHeading>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const LongLabel: Story = {
  args: {
    children: "Advanced reading preferences",
  },
};

export const InSectionContext: Story = {
  render: () => (
    <div className="space-y-3">
      <SectionHeading>Appearance</SectionHeading>
      <div className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground-soft">
        Theme and typography preferences live in this section.
      </div>
    </div>
  ),
};
