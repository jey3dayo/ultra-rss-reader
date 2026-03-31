import type { Meta, StoryObj } from "@storybook/react-vite";
import { BookOpen, Palette, Settings } from "lucide-react";
import { fn } from "storybook/test";
import { AccountsNavView } from "./accounts-nav-view";
import { SettingsModalView } from "./settings-modal-view";
import { SettingsNavView } from "./settings-nav-view";

const meta = {
  title: "Settings/SettingsModalView",
  component: SettingsModalView,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
  },
  args: {
    open: true,
    title: "Preferences",
    closeLabel: "Close preferences",
    navigation: (
      <SettingsNavView
        items={[
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
        ]}
        onSelectCategory={fn()}
      />
    ),
    accountsNavigation: (
      <AccountsNavView
        accounts={[
          { id: "acc-1", name: "Local", kind: "local", isActive: true },
          { id: "acc-2", name: "FreshRSS", kind: "freshrss", isActive: false },
        ]}
        addAccountLabel="Add account…"
        isAddAccountActive={false}
        onSelectAccount={fn()}
        onAddAccount={fn()}
      />
    ),
    content: (
      <div className="p-6">
        <h2 className="text-lg font-semibold">General settings</h2>
        <p className="mt-2 text-sm text-muted-foreground">Fixture-only story for the isolated modal layout.</p>
      </div>
    ),
    onClose: fn(),
    onOpenChange: fn(),
  },
  decorators: [
    (Story) => (
      <div className="min-h-screen bg-background p-8">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SettingsModalView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
