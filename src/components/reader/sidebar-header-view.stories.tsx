import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn, userEvent, within } from "storybook/test";
import { denseNarrowViewportParameters } from "@/components/storybook/viewport-fixtures";
import { AppToastView } from "@/design-system";
import i18n from "@/lib/i18n";
import { type SidebarHeaderProps, SidebarHeaderView } from "./sidebar-header-view";

const meta = {
  title: "Reader/Sidebar/SidebarHeaderView",
  component: SidebarHeaderView,
  tags: ["autodocs"],
  args: {
    onSync: fn(),
    onAddFeed: fn(),
    syncButtonLabel: "Sync feeds",
    syncButtonText: "Sync",
    addFeedButtonLabel: "Add feed",
    addFeedButtonText: "Add",
    displayState: {
      layout: "desktop",
      titlebar: "standard",
    },
    syncState: {
      status: "idle",
    },
  },
  decorators: [
    (Story) => (
      <div className="w-full max-w-[280px] bg-sidebar text-sidebar-foreground">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SidebarHeaderView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const ClickToSpin: Story = {
  parameters: {
    docs: {
      description: {
        story: "Click the sync button to preview the one-second accepted-spin feedback.",
      },
    },
  },
};

function SyncingFeedbackStory(args: SidebarHeaderProps) {
  const [toastOpen, setToastOpen] = useState(false);
  return (
    <div className="flex flex-col gap-4">
      <SidebarHeaderView
        {...args}
        onSync={() => {
          args.onSync();
          setToastOpen(true);
        }}
      />
      {toastOpen && (
        <AppToastView
          position="static"
          toastMessage={{ message: i18n.getFixedT("en", "sidebar")("sync_already_in_progress"), severity: "info" }}
          onClose={() => setToastOpen(false)}
        />
      )}
    </div>
  );
}

export const Syncing: Story = {
  render: (args) => <SyncingFeedbackStory {...args} />,
  play: async ({ canvasElement, args }) => {
    const button = within(canvasElement).getByRole("button", { name: "Sync feeds" });
    await expect(button).toBeEnabled();
    await expect(button).toHaveAttribute("aria-busy", "true");
    await userEvent.click(button);
    await expect(args.onSync).toHaveBeenCalled();
    await expect(
      within(canvasElement).getByText(i18n.getFixedT("en", "sidebar")("sync_already_in_progress")),
    ).toBeVisible();
  },
  args: {
    syncState: {
      status: "syncing",
    },
  },
};

export const CooldownTooltip: Story = {
  parameters: {
    docs: {
      description: {
        story: "Cooldown preview only. The button stays hoverable for tooltip feedback, but it does not spin.",
      },
    },
  },
  args: {
    syncTooltipLabel: "Sync available in 15s",
    syncState: {
      status: "cooldown",
    },
  },
};

export const DenseNarrowViewport: Story = {
  parameters: denseNarrowViewportParameters,
  decorators: [
    (Story) => (
      <div className="w-[220px] bg-sidebar text-sidebar-foreground">
        <Story />
      </div>
    ),
  ],
  args: {
    syncButtonLabel: "すべてのフィードを同期",
    syncButtonText: "同期",
    addFeedButtonLabel: "購読フィードを追加",
    addFeedButtonText: "追加",
    displayState: {
      layout: "mobile",
      titlebar: "standard",
    },
  },
};
