import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import type { SubscriptionFilterOption } from "@/lib/subscriptions/subscriptions-index.types";
import { SubscriptionsFilterBar, type SubscriptionsFilterBarModel } from "./subscriptions-filter-bar";

const frequentCriteria = "直近30日で20本以上かつ未読50件以上";

function buildModel(counts: {
  all: number | null;
  stale: number | null;
  frequent: number | null;
  fetchErrors?: number;
  active?: SubscriptionFilterOption["filterKey"];
}): SubscriptionsFilterBarModel {
  const active = counts.active ?? "all";
  const options: SubscriptionFilterOption[] = [
    { filterKey: "all", label: "総購読数", count: counts.all, isActive: active === "all" },
    { filterKey: "stale", label: "90日以上未更新", count: counts.stale, isActive: active === "stale" },
    {
      filterKey: "frequent",
      label: "更新過多",
      count: counts.frequent,
      isActive: active === "frequent",
      tooltip: frequentCriteria,
    },
  ];
  if (counts.fetchErrors !== undefined) {
    options.push({
      filterKey: "fetch_errors",
      label: "取得エラー",
      count: counts.fetchErrors,
      isActive: active === "fetch_errors",
    });
  }
  return { ariaLabel: "購読の絞り込み", options, activeDescription: null };
}

const meta = {
  title: "Subscriptions/Summary/SubscriptionsFilterBar",
  component: SubscriptionsFilterBar,
  tags: ["autodocs"],
  args: {
    model: buildModel({ all: 42, stale: 8, frequent: 6 }),
    onSelect: fn(),
  },
  decorators: [
    (Story) => (
      <div className="min-h-32 bg-background p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SubscriptionsFilterBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithFetchErrors: Story = {
  args: { model: buildModel({ all: 42, stale: 8, frequent: 6, fetchErrors: 2, active: "fetch_errors" }) },
};

export const CountsUnavailable: Story = {
  args: {
    model: buildModel({ all: 42, stale: null, frequent: null }),
    loadFailure: {
      message: "購読の集計を読み込めませんでした。",
      retryLabel: "再試行",
      retrying: false,
      onRetry: fn(),
    },
  },
};
