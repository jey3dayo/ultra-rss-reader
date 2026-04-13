import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { GeneralSettingsView } from "./general-settings-view";

const meta = {
  title: "Settings/GeneralSettingsView",
  component: GeneralSettingsView,
  tags: ["autodocs"],
  args: {
    title: "General",
    sections: [
      {
        id: "language",
        heading: "Language",
        controls: [
          {
            id: "language",
            type: "select",
            name: "language",
            label: "Language",
            value: "system",
            options: [
              { value: "system", label: "System default" },
              { value: "en", label: "English" },
              { value: "ja", label: "日本語" },
            ],
            onChange: fn(),
          },
        ],
      },
      {
        id: "browser",
        heading: "Browser",
        note: "Open links in the background when possible.",
        controls: [
          {
            id: "open-links",
            type: "select",
            name: "open_links",
            label: "Open links",
            value: "in_app",
            options: [
              { value: "in_app", label: "In-app browser" },
              { value: "default_browser", label: "Default browser" },
            ],
            onChange: fn(),
          },
          {
            id: "open-links-background",
            type: "switch",
            label: "Open links in background",
            checked: true,
            onChange: fn(),
          },
        ],
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
} satisfies Meta<typeof GeneralSettingsView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
