import type { Meta, StoryObj } from "@storybook/react-vite";
import { GradientSwitch } from "./gradient-switch";

const meta = {
  title: "Shared/GradientSwitch",
  component: GradientSwitch,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="flex items-center gap-4 p-8">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof GradientSwitch>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Off: Story = {
  args: {
    checked: false,
  },
};

export const On: Story = {
  args: {
    checked: true,
  },
};

export const Disabled: Story = {
  args: {
    checked: false,
    disabled: true,
  },
};

export const DisabledChecked: Story = {
  args: {
    checked: true,
    disabled: true,
  },
};

export const WithLabel: Story = {
  render: (args) => (
    <div className="flex items-center gap-3 text-sm text-foreground">
      <GradientSwitch {...args} aria-label="バックグラウンドでリンクを開く" />
      <span>バックグラウンドでリンクを開く</span>
    </div>
  ),
  args: {
    defaultChecked: true,
  },
};

export const SettingsRow: Story = {
  render: (args) => (
    <div className="w-full max-w-[400px] space-y-0">
      <div className="flex min-h-[44px] items-center justify-between border-b border-border py-3">
        <span className="text-sm text-foreground">バックグラウンドでリンクを開く</span>
        <GradientSwitch {...args} />
      </div>
      <div className="flex min-h-[44px] items-center justify-between border-b border-border py-3">
        <span className="text-sm text-foreground">⌘クリックでアプリ内ブラウザを開く</span>
        <GradientSwitch defaultChecked />
      </div>
      <div className="flex min-h-[44px] items-center justify-between border-b border-border py-3">
        <span className="text-sm text-foreground">実行前に確認する</span>
        <GradientSwitch defaultChecked />
      </div>
    </div>
  ),
  args: {},
};
