import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { AppToastView } from "./app-toast-view";

const meta = {
  title: "Shared/Feedback/AppToastView",
  component: AppToastView,
  args: { onClose: fn(), position: "static" },
} satisfies Meta<typeof AppToastView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const UpdateReadyDecision: Story = {
  args: {
    toastMessage: {
      message: "v0.67.2 の更新を準備しました。再起動後に適用されます",
      persistent: true,
      variant: "update",
      actions: [
        { label: "今すぐ再起動", onClick: fn() },
        { label: "後で", onClick: fn() },
      ],
    },
  },
};

export const SingleActionInformational: Story = {
  args: {
    toastMessage: {
      message: "同期に失敗しました",
      actions: [{ label: "再試行", onClick: fn() }],
    },
  },
};
