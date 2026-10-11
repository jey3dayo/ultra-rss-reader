import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { SubscriptionsOverviewSummary } from "./subscriptions-overview-summary";

const summaryCards = [
  {
    filterKey: "fetch_errors",
    label: "取得エラー",
    value: "0",
    caption: "取得エラーのあるフィードはありません",
    isActionable: false,
  },
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
  { filterKey: "frequent", label: "更新頻度が高い", value: "6", caption: "直近30日で更新の多いフィード" },
] satisfies React.ComponentProps<typeof SubscriptionsOverviewSummary>["cards"];

const unknownFetchStatusCards = summaryCards.map((card) =>
  card.filterKey === "fetch_errors" ? { ...card, value: "確認中", caption: "取得状態を確認しています" } : card,
) satisfies React.ComponentProps<typeof SubscriptionsOverviewSummary>["cards"];

const unavailableFetchStatusCards = summaryCards.map((card) =>
  card.filterKey === "fetch_errors" ? { ...card, value: "未取得", caption: "取得状態を確認できません" } : card,
) satisfies React.ComponentProps<typeof SubscriptionsOverviewSummary>["cards"];

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

export const FetchErrors: Story = {
  args: {
    cards: [
      {
        filterKey: "fetch_errors",
        label: "取得エラー",
        value: "2",
        caption: "2 件のフィードで取得エラーがあります",
        tone: "danger",
      },
      ...summaryCards.slice(1),
    ],
  },
};

export const FetchStatusLoading: Story = {
  args: { cards: unknownFetchStatusCards },
};

export const FetchStatusUnavailable: Story = {
  args: { cards: unavailableFetchStatusCards },
};
