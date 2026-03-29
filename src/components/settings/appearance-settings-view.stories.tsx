import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { AppearanceSettingsView } from "./appearance-settings-view";

const meta = {
  title: "Settings/AppearanceSettingsView",
  component: AppearanceSettingsView,
  tags: ["autodocs"],
  args: {
    title: "Appearance",
    sections: [
      {
        id: "appearance-general",
        heading: "General",
        controls: [
          {
            id: "theme",
            type: "select",
            name: "theme",
            label: "Theme",
            value: "dark",
            options: [
              { value: "light", label: "Light" },
              { value: "dark", label: "Dark" },
              { value: "system", label: "Automatic" },
            ],
            onChange: fn(),
          },
          {
            id: "opaque-sidebars",
            type: "switch",
            label: "Opaque sidebars",
            checked: false,
            onChange: fn(),
          },
        ],
      },
      {
        id: "text",
        heading: "Text",
        controls: [
          {
            id: "font-style",
            type: "select",
            name: "font_style",
            label: "App font style",
            value: "sans_serif",
            options: [
              { value: "sans_serif", label: "Sans serif" },
              { value: "serif", label: "Serif" },
              { value: "monospace", label: "Monospace" },
            ],
            onChange: fn(),
          },
        ],
      },
    ],
  },
  decorators: [
    (Story) => (
      <div className="w-[420px] bg-background p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AppearanceSettingsView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
