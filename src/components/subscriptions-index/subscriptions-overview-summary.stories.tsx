import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { SubscriptionsOverviewSummary } from "./subscriptions-overview-summary";

const summaryCards = [
  {
    filterKey: "fetch_errors",
    label: "取得エラー",
    value: "0",
    caption: "取得エラーのある購読はありません",
    isActionable: false,
  },
  {
    filterKey: "all",
    label: "Total subscriptions",
    value: "42",
    caption: "All subscriptions in this account",
    isActive: true,
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

export const StaleActive: Story = {
  args: {
    cards: summaryCards.map((card) => ({
      ...card,
      isActive: card.filterKey === "stale" && card.isActionable !== false,
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
        caption: "2 件の購読で取得エラーがあります",
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

const unavailableSummaryCards = summaryCards.map((card) =>
  card.filterKey === "all" || card.filterKey === "fetch_errors"
    ? card
    : { ...card, value: "未取得", caption: "", tone: "neutral", isActionable: false },
) satisfies React.ComponentProps<typeof SubscriptionsOverviewSummary>["cards"];

export const SummaryUnavailable: Story = {
  args: {
    cards: unavailableSummaryCards,
    loadFailure: {
      message: "購読の集計を読み込めませんでした。",
      retryLabel: "再試行",
      retrying: false,
      onRetry: fn(),
    },
  },
};
