import type { Meta, StoryObj } from "@storybook/react-vite";
import { BookOpen, Palette, Settings } from "lucide-react";
import { fn } from "storybook/test";
import { SettingsNavView } from "./settings-nav-view";

const meta = {
  title: "Settings/SettingsNavView",
  component: SettingsNavView,
  tags: ["autodocs"],
  args: {
    items: [
      {
        id: "general",
        label: "General",
        icon: <Settings className="h-5 w-5" />,
        isActive: true,
      },
      {
        id: "appearance",
        label: "Appearance",
        icon: <Palette className="h-5 w-5" />,
        isActive: false,
      },
      {
        id: "reading",
        label: "Reading",
        icon: <BookOpen className="h-5 w-5" />,
        isActive: false,
      },
    ],
    onSelectCategory: fn(),
  },
  decorators: [
    (Story) => (
      <div className="w-full max-w-[260px] bg-sidebar text-sidebar-foreground">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SettingsNavView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const AppearanceActive: Story = {
  args: {
    items: [
      {
        id: "general",
        label: "General",
        icon: <Settings className="h-5 w-5" />,
        isActive: false,
      },
      {
        id: "appearance",
        label: "Appearance",
        icon: <Palette className="h-5 w-5" />,
        isActive: true,
      },
      {
        id: "reading",
        label: "Reading",
        icon: <BookOpen className="h-5 w-5" />,
        isActive: false,
      },
    ],
  },
};
