import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { ReadingSettingsView } from "./reading-settings-view";

const meta = {
  title: "Settings/ReadingSettingsView",
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
            id: "reader-view",
            type: "select",
            name: "reader_view",
            label: "Reader View",
            value: "auto",
            options: [
              { value: "off", label: "Off" },
              { value: "on", label: "On" },
              { value: "auto", label: "Automatic" },
            ],
            onChange: fn(),
          },
          {
            id: "after-reading",
            type: "select",
            name: "after_reading",
            label: "After reading",
            value: "mark_as_read",
            options: [
              { value: "mark_as_read", label: "Mark as read" },
              { value: "do_nothing", label: "Do nothing" },
              { value: "archive", label: "Archive" },
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
      <div className="w-[420px] bg-background p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ReadingSettingsView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
