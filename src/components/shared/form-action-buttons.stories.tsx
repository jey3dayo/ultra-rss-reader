import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { FormActionButtons } from "./form-action-buttons";

const meta = {
  title: "Shared/Controls/FormActionButtons",
  component: FormActionButtons,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="flex flex-wrap gap-2 p-6">
        <Story />
      </div>
    ),
  ],
  args: {
    cancelLabel: "Cancel",
    submitLabel: "Save",
    submittingLabel: "Saving",
    onCancel: fn(),
    onSubmit: fn(),
  },
} satisfies Meta<typeof FormActionButtons>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Loading: Story = {
  args: {
    loading: true,
  },
};

export const Disabled: Story = {
  args: {
    cancelDisabled: true,
    submitDisabled: true,
  },
};

export const LongLocalizedLabels: Story = {
  decorators: [
    (Story) => (
      <div className="w-[220px]">
        <Story />
      </div>
    ),
  ],
  args: {
    cancelLabel: "詳細な同期設定を破棄",
    submitLabel: "変更内容を保存して同期を再開",
    submittingLabel: "同期設定を保存しています",
  },
};
