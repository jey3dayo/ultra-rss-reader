import type { Meta, StoryObj } from "@storybook/react-vite";
import { DebugHudFrame } from "./debug-hud-frame";

const meta = {
  title: "Internal/Debug/DebugHudFrame",
  component: DebugHudFrame,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Debug HUD surfaces are shell examples for diagnostics overlays. They are intentionally separate from standard section/card specimens.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="flex min-h-[220px] w-full items-center justify-center bg-background p-6 dark:bg-[var(--browser-overlay-shell)]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof DebugHudFrame>;

export default meta;
type Story = StoryObj<typeof meta>;

export const PanelCollapsed: Story = {
  args: {
    as: "section",
    surface: "panelCollapsed",
    children: "Panel diagnostics",
  },
};

export const StripCompact: Story = {
  args: {
    surface: "stripCompact",
    children: "Focus HUD strip",
  },
};
