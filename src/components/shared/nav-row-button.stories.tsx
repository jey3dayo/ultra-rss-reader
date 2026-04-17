import type { Meta, StoryObj } from "@storybook/react-vite";
import { ChevronRight, Folder, Settings } from "lucide-react";
import { fn } from "storybook/test";
import { NavRowButton } from "./nav-row-button";

const meta = {
  title: "Shared/Navigation/NavRowButton",
  component: NavRowButton,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  args: {
    title: "General",
    onClick: fn(),
  },
} satisfies Meta<typeof NavRowButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  decorators: [
    (Story) => (
      <div className="max-w-sm">
        <Story />
      </div>
    ),
  ],
};

export const WithDescription: Story = {
  args: {
    title: "FreshRSS account",
    description: "Primary sync source for desktop and web preview state.",
    leading: <Folder className="h-4 w-4 text-foreground-soft" />,
    trailing: <ChevronRight className="h-4 w-4 text-foreground-soft" />,
  },
  decorators: [
    (Story) => (
      <div className="max-w-sm">
        <Story />
      </div>
    ),
  ],
};

export const SidebarSelected: Story = {
  args: {
    tone: "sidebar",
    selected: true,
    title: "Appearance",
    leading: <Settings className="h-4 w-4" />,
  },
  decorators: [
    (Story) => (
      <div className="max-w-[260px] bg-sidebar p-2 text-sidebar-foreground">
        <Story />
      </div>
    ),
  ],
};

export const Disabled: Story = {
  args: {
    title: "Archived account",
    description: "This row is currently unavailable.",
    disabled: true,
  },
  decorators: [
    (Story) => (
      <div className="max-w-sm">
        <Story />
      </div>
    ),
  ],
};
