import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { ContextMenu } from "@/design-system";
import { SubscriptionsSectionContextMenuView } from "./subscriptions-section-context-menu-view";

const meta = {
  title: "Reader/Menu/SubscriptionsSectionContextMenuView",
  component: SubscriptionsSectionContextMenuView,
  tags: ["autodocs"],
  args: {
    expandAllFoldersLabel: "Expand all folders",
    collapseAllFoldersLabel: "Collapse all folders",
    onExpandAllFolders: fn(),
    onCollapseAllFolders: fn(),
  },
  render: (args) => (
    <div className="min-h-48 bg-background p-16">
      <ContextMenu.Root open>
        <ContextMenu.Trigger className="inline-flex rounded-md border border-border px-3 py-2 text-sm text-foreground">
          Subscriptions
        </ContextMenu.Trigger>
        <SubscriptionsSectionContextMenuView {...args} />
      </ContextMenu.Root>
    </div>
  ),
} satisfies Meta<typeof SubscriptionsSectionContextMenuView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
