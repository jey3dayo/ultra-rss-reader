import type { Meta, StoryObj } from "@storybook/react-vite";
import { BookOpen, Palette, Settings } from "lucide-react";
import { fn } from "storybook/test";
import { AccountsNavView } from "./accounts-nav-view";
import { SettingsModalView } from "./settings-modal-view";
import { SettingsNavView } from "./settings-nav-view";

const meta = {
  title: "Settings/Page/SettingsModalView",
  component: SettingsModalView,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
  },
  args: {
    open: true,
    title: "Preferences",
    closeLabel: "Close preferences",
    accountsHeading: "Accounts",
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
        <p className="mt-2 text-sm text-foreground-soft">Fixture-only story for the isolated modal layout.</p>
      </div>
    ),
    contentResetKey: "general::false",
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

export const Loading: Story = {
  args: {
    isLoading: true,
  },
};

export const DenseNarrowViewport: Story = {
  parameters: {
    viewport: {
      defaultViewport: "mobile2",
    },
  },
  decorators: [
    (Story) => (
      <div className="min-h-screen bg-background p-2">
        <Story />
      </div>
    ),
  ],
  args: {
    title: "環境設定",
    closeLabel: "環境設定を閉じる",
    accountsHeading: "アカウント",
    navigation: (
      <SettingsNavView
        items={[
          {
            id: "general",
            label: "一般設定",
            icon: <Settings className="h-5 w-5" />,
            isActive: true,
          },
          {
            id: "appearance",
            label: "表示とテーマ",
            icon: <Palette className="h-5 w-5" />,
            isActive: false,
          },
          {
            id: "reading",
            label: "記事の読み方",
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
          {
            id: "acc-long-local",
            name: "ローカル検証用アカウント",
            kind: "local",
            isActive: true,
          },
          {
            id: "acc-long-freshrss",
            name: "FreshRSS 長い表示名の検証",
            kind: "freshrss",
            username: "very-long-localized-account-name",
            serverUrl: "https://reader.example.test/api/greader.php",
            isActive: false,
          },
        ]}
        addAccountLabel="アカウントを追加"
        isAddAccountActive={false}
        onSelectAccount={fn()}
        onAddAccount={fn()}
      />
    ),
    content: (
      <div className="p-6">
        <h2 className="text-lg font-semibold">一般設定</h2>
        <p className="mt-2 text-sm text-foreground-soft">
          狭いビューポートで設定のナビゲーション、アカウント一覧、コンテンツ領域を同時に確認するための fixture。
        </p>
      </div>
    ),
    contentResetKey: "dense-narrow::false",
  },
};
