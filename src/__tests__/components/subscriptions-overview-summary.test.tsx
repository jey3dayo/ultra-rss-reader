import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SubscriptionsOverviewSummary } from "@/components/subscriptions-index/subscriptions-overview-summary";

describe("SubscriptionsOverviewSummary", () => {
  it("uses semantic soft foreground text and neutral action chips", () => {
    render(
      <SubscriptionsOverviewSummary
        cards={[
          {
            filterKey: "review",
            label: "Needs review",
            value: "2",
            caption: "Check these feeds",
            tone: "review",
          },
          {
            filterKey: "all",
            label: "Healthy",
            value: "5",
            caption: "All good",
          },
        ]}
        onSelectFilter={vi.fn()}
      />,
    );

    const summarySection = screen.getByRole("button", { name: /Needs review/ }).closest("section");
    expect(summarySection).not.toBeNull();
    expect(summarySection).toHaveClass("rounded-lg", "border-border/55");
    expect(summarySection).toHaveStyle({ backgroundColor: "var(--subscriptions-summary-surface)" });
    expect(summarySection?.querySelector(".grid")).toHaveClass("grid-cols-1", "gap-3");

    const actionableCard = screen.getByRole("button", { name: /Needs review/ });
    expect(actionableCard).toHaveClass("w-full", "min-w-0");
    expect(actionableCard).toHaveClass("sm:col-span-2", "lg:col-span-1");
    expect(within(actionableCard).getByText("Needs review")).toHaveClass("text-foreground-soft");
    expect(within(actionableCard).getByText("Check these feeds")).toHaveClass("text-foreground-soft");
    expect(within(actionableCard).getByText("絞り込む").closest("span")).toHaveAttribute("data-label-chip", "neutral");

    const neutralCard = screen.getByRole("button", { name: /Healthy/ });
    expect(neutralCard).not.toBeNull();
    expect(within(neutralCard).getByText("Healthy")).toHaveClass("text-foreground-soft");
    expect(within(neutralCard).getByText("All good")).toHaveClass("text-foreground-soft");
  });

  it("reserves the active badge slot to avoid layout shift", () => {
    render(
      <SubscriptionsOverviewSummary
        cards={[
          {
            filterKey: "review",
            label: "Needs review",
            value: "2",
            caption: "Check these feeds",
            tone: "review",
            isActive: true,
          },
          {
            filterKey: "all",
            label: "Healthy",
            value: "5",
            caption: "All good",
            isActive: false,
          },
        ]}
        onSelectFilter={vi.fn()}
      />,
    );

    const cards = screen.getAllByTestId("subscriptions-summary-card-badge-slot");
    expect(cards).toHaveLength(2);
    expect(cards[0]).toHaveClass("min-w-[4.75rem]");
    expect(cards[1]).toHaveClass("min-w-[4.75rem]");
    expect(within(cards[0]).getByText("表示中")).toBeInTheDocument();
    expect(within(cards[1]).getByText("表示中")).toHaveClass("invisible");
  });

  it("applies tone-linked emphasis to the active badge and metric", () => {
    render(
      <SubscriptionsOverviewSummary
        cards={[
          {
            filterKey: "review",
            label: "Needs review",
            value: "2",
            caption: "Check these feeds",
            tone: "review",
            isActive: true,
          },
        ]}
        onSelectFilter={vi.fn()}
      />,
    );

    const activeCard = screen.getByRole("button", { name: /Needs review/ });
    expect(within(activeCard).getByText("表示中")).toHaveClass(
      "border-state-review-border/75",
      "bg-state-review-surface/92",
      "text-state-review-foreground",
    );
    expect(activeCard).toHaveClass("shadow-[var(--subscriptions-summary-active-shadow-review)]");
    expect(activeCard).toHaveClass("ring-[color:var(--subscriptions-summary-active-ring-review)]");
    expect(within(activeCard).getByText("2")).toHaveClass("text-state-review-foreground");
  });

  it("uses all-items copy when the total card is active", () => {
    render(
      <SubscriptionsOverviewSummary
        cards={[
          {
            filterKey: "all",
            label: "Total subscriptions",
            value: "10",
            caption: "All feeds in the workspace",
            isActive: true,
          },
        ]}
        onSelectFilter={vi.fn()}
      />,
    );

    const activeCard = screen.getByRole("button", { name: /Total subscriptions/ });
    expect(within(activeCard).getByText("表示中")).toBeInTheDocument();
    expect(within(activeCard).getByText("全件表示")).toBeInTheDocument();
    expect(within(activeCard).queryByText("フィルタ中")).toBeNull();
  });

  it("uses all-items copy when the total card is inactive", () => {
    render(
      <SubscriptionsOverviewSummary
        cards={[
          {
            filterKey: "all",
            label: "Total subscriptions",
            value: "10",
            caption: "All feeds in the workspace",
            isActive: false,
          },
        ]}
        onSelectFilter={vi.fn()}
      />,
    );

    const card = screen.getByRole("button", { name: /Total subscriptions/ });
    expect(within(card).getByText("すべて表示")).toBeInTheDocument();
    expect(within(card).queryByText("フィルタ中")).toBeNull();
  });
});
