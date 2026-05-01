import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { SubscriptionsOverviewSummary } from "./subscriptions-overview-summary";

const summaryCards = [
  {
    filterKey: "all",
    label: "Total subscriptions",
    value: "42",
    caption: "All feeds in the workspace",
    isActive: true,
  },
  {
    filterKey: "review",
    label: "Needs review",
    value: "3",
    caption: "Low activity or duplicate candidates",
    tone: "review",
  },
  {
    filterKey: "stale",
    label: "Stale feeds",
    value: "8",
    caption: "No recent articles in 30 days",
    tone: "stale",
  },
  {
    filterKey: "all",
    label: "Sync state",
    value: "Healthy",
    caption: "Last checked a few minutes ago",
    isActionable: false,
  },
] satisfies React.ComponentProps<typeof SubscriptionsOverviewSummary>["cards"];

const meta = {
  title: "Subscriptions/Summary/SubscriptionsOverviewSummary",
  component: SubscriptionsOverviewSummary,
  tags: ["autodocs"],
  args: {
    cards: summaryCards,
    onSelectFilter: fn(),
  },
  decorators: [
    (Story) => (
      <div className="min-h-64 bg-background p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SubscriptionsOverviewSummary>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const ReviewActive: Story = {
  args: {
    cards: summaryCards.map((card) => ({
      ...card,
      isActive: card.filterKey === "review" && card.isActionable !== false,
    })),
  },
};
