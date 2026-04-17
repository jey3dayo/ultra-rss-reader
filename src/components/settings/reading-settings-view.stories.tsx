import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { ReadingSettingsView } from "./reading-settings-view";

const meta = {
  title: "Settings/Page/ReadingSettingsView",
  component: ReadingSettingsView,
  tags: ["autodocs"],
  args: {
    title: "Reading",
    sections: [
      {
        id: "reading-general",
        heading: "General",
        controls: [
          {
            id: "display-preset",
            type: "select",
            name: "display_preset",
            label: "Default display mode",
            value: "standard",
            options: [
              { value: "standard", label: "Standard" },
              { value: "preview", label: "Preview" },
            ],
            onChange: fn(),
          },
          {
            id: "after-reading",
            type: "select",
            name: "after_reading",
            label: "When opening an article",
            value: "immediately",
            options: [
              { value: "never", label: "Do nothing" },
              { value: "immediately", label: "Mark immediately" },
              { value: "after_1s", label: "Mark after 1 second" },
            ],
            onChange: fn(),
          },
        ],
      },
      {
        id: "scroll",
        heading: "Scroll",
        controls: [
          {
            id: "scroll-to-top-on-change",
            type: "switch",
            label: "Scroll to top on feed change",
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
} satisfies Meta<typeof ReadingSettingsView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
