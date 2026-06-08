import type { Meta, StoryObj } from "@storybook/react-vite";
import { Copy, ExternalLink, Globe } from "lucide-react";
import { fn } from "storybook/test";
import { ActionsSettingsView } from "./actions-settings-view";

const meta = {
  title: "Settings/Category/ActionsSettingsView",
  component: ActionsSettingsView,
  tags: ["autodocs"],
  args: {
    title: "Actions",
    heading: "Services",
    toggleLabel: "Show in toolbar",
    services: [
      {
        id: "copy-link",
        label: "Copy link",
        toggleAriaLabel: "Show Copy link in toolbar",
        icon: <Copy className="size-5" />,
        checked: true,
        onCheckedChange: fn(),
      },
      {
        id: "open-browser",
        label: "Open in browser",
        toggleAriaLabel: "Show Open in browser in toolbar",
        icon: <Globe className="size-5" />,
        checked: true,
        onCheckedChange: fn(),
      },
      {
        id: "external-browser",
        label: "Open in external browser",
        toggleAriaLabel: "Show Open in external browser in toolbar",
        icon: <ExternalLink className="size-5" />,
        checked: false,
        onCheckedChange: fn(),
      },
    ],
  },
  decorators: [
    (Story) => (
      <div className="w-full max-w-[420px] bg-background p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ActionsSettingsView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
