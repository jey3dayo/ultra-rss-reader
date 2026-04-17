import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { ShortcutsSettingsView } from "./shortcuts-settings-view";

const meta = {
  title: "Settings/Page/ShortcutsSettingsView",
  component: ShortcutsSettingsView,
  tags: ["autodocs"],
  args: {
    title: "Shortcuts",
    conflictMessage: null,
    pressAKeyLabel: "Press a key",
    resetLabel: "Reset to defaults",
    resetDisabled: false,
    onResetAll: fn(),
    categories: [
      {
        id: "navigation",
        heading: "Navigation",
        items: [
          {
            id: "next_article",
            label: "Next article",
            displayKey: "J",
            isRecording: false,
            conflictLabel: null,
            onStartRecording: fn(),
            onKeyDown: fn(),
          },
          {
            id: "prev_article",
            label: "Previous article",
            displayKey: "K",
            isRecording: false,
            conflictLabel: null,
            onStartRecording: fn(),
            onKeyDown: fn(),
          },
        ],
      },
      {
        id: "global",
        heading: "Global",
        items: [
          {
            id: "open_settings",
            label: "Open settings",
            displayKey: "⌘ ,",
            isLocked: true,
            isRecording: false,
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
} satisfies Meta<typeof ShortcutsSettingsView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Recording: Story = {
  args: {
    categories: [
      {
        id: "navigation",
        heading: "Navigation",
        items: [
          {
            id: "next_article",
            label: "Next article",
            displayKey: "J",
            isRecording: true,
            conflictLabel: null,
            onStartRecording: fn(),
            onKeyDown: fn(),
          },
        ],
      },
    ],
  },
};
