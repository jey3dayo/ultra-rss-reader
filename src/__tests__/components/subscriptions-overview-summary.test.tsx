import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SubscriptionsOverviewSummary } from "@/components/subscriptions-index/subscriptions-overview-summary";

function getRequiredHTMLElement(element: Element | null, description: string) {
  if (!(element instanceof HTMLElement)) {
    throw new Error(`Expected ${description} to be an HTML element`);
  }
  return element;
}

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
        reviewCriteriaLabel="Needs review: quiet feeds or weak usage signals."
        onSelectFilter={vi.fn()}
      />,
    );

    const summarySection = screen.getByRole("button", { name: /Needs review/ }).closest("section");
    expect(summarySection).not.toBeNull();
    expect(summarySection).toHaveClass(
      "rounded-md",
      "border-border/60",
      "shadow-[0_18px_48px_-42px_rgba(38,37,30,0.32)]",
    );
    expect(summarySection).toHaveStyle({
      backgroundColor: "var(--subscriptions-summary-surface)",
    });
    expect(summarySection?.querySelector(".grid")).toHaveClass(
      "grid-cols-1",
      "sm:grid-cols-[repeat(auto-fit,minmax(13rem,1fr))]",
      "gap-3.5",
    );
    expect(screen.queryByText("Needs review: quiet feeds or weak usage signals.")).toBeNull();

    const actionableCard = screen.getByRole("button", { name: /Needs review/ });
    expect(actionableCard).toHaveClass("w-full", "min-w-0");
    expect(actionableCard).toHaveClass("rounded-md", "focus-visible:ring-2");
    expect(actionableCard).toHaveClass("sm:col-span-2", "lg:col-span-1");
    expect(actionableCard).toHaveAttribute("aria-pressed", "false");
    expect(actionableCard).toBeVisible();
    expect(within(actionableCard).getByText("Needs review")).toHaveClass("text-foreground-soft");
    expect(within(actionableCard).getByText("Check these feeds")).toHaveClass("text-foreground-soft");
    expect(within(actionableCard).getByText("絞り込む").closest("span")).toHaveAttribute("data-label-chip", "neutral");
    expect(within(actionableCard).getByText("条件")).toHaveClass("text-foreground-soft");
    const statusIcon = actionableCard.querySelector("svg[aria-hidden='true']");
    expect(statusIcon).not.toBeNull();
    expect(statusIcon).toHaveClass("size-3");
    expect(statusIcon).toBeVisible();
    expect(within(actionableCard).getByText("条件")).toBeVisible();

    const neutralCard = screen.getByRole("button", { name: /Healthy/ });
    expect(neutralCard).not.toBeNull();
    expect(neutralCard).toBeVisible();
    expect(within(neutralCard).getByText("Healthy")).toHaveClass("text-foreground-soft");
    expect(within(neutralCard).getByText("All good")).toHaveClass("text-foreground-soft");
  });

  it("shows review criteria from the review summary card tooltip", async () => {
    const user = userEvent.setup();

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
        ]}
        reviewCriteriaLabel="Needs review: quiet feeds or weak usage signals."
        onSelectFilter={vi.fn()}
      />,
    );

    await user.hover(screen.getByRole("button", { name: "Needs review を表示" }));

    expect(await screen.findByText("Needs review: quiet feeds or weak usage signals.")).toHaveClass(
      "motion-popup-surface",
    );
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
      "shadow-[var(--subscriptions-summary-badge-shadow)]",
    );
    expect(within(activeCard).getByText("フィルタ中").closest("[data-label-chip]")).toHaveClass(
      "shadow-[var(--subscriptions-summary-active-chip-shadow)]",
    );
    expect(activeCard).toHaveClass("shadow-[var(--subscriptions-summary-active-shadow-review)]");
    expect(activeCard).toHaveClass("ring-[color:var(--subscriptions-summary-active-ring-review)]");
    const metric = within(activeCard).getByText("2");
    expect(metric).toHaveClass("tabular-nums");
    expect(metric.closest(".t-digit-group")).toBeNull();
    expect(metric.parentElement).toHaveClass("text-state-review-foreground");
    expect(activeCard).toHaveAttribute("aria-pressed", "true");
  });

  it("sends the selected filter key from actionable card buttons", () => {
    const handleSelectFilter = vi.fn();

    render(
      <SubscriptionsOverviewSummary
        cards={[
          {
            filterKey: "review",
            label: "Needs review",
            value: "2",
            caption: "Check these feeds",
            tone: "review",
            isActive: false,
          },
        ]}
        onSelectFilter={handleSelectFilter}
      />,
    );

    const card = screen.getByRole("button", { name: "Needs review を表示" });
    expect(card).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(card);

    expect(handleSelectFilter).toHaveBeenCalledTimes(1);
    expect(handleSelectFilter).toHaveBeenCalledWith("review");
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

    const activeCard = screen.getByRole("button", {
      name: /Total subscriptions/,
    });
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

  it("softens zero-count review and stale cards without splitting numeric text", () => {
    render(
      <SubscriptionsOverviewSummary
        cards={[
          {
            filterKey: "review",
            label: "Needs review",
            value: "0",
            caption: "0 feeds need a decision",
            tone: "review",
            isActive: false,
          },
          {
            filterKey: "stale",
            label: "90-day stale",
            value: "0",
            caption: "0 feeds have gone quiet",
            tone: "stale",
            isActive: false,
          },
        ]}
        onSelectFilter={vi.fn()}
      />,
    );

    const reviewCard = screen.getByRole("button", { name: "Needs review を表示" });
    const staleCard = screen.getByRole("button", { name: "90-day stale を表示" });

    expect(reviewCard).toHaveClass("border-border/60", "bg-surface-1/62");
    expect(reviewCard).not.toHaveClass("sm:col-span-2", "bg-state-review-surface/86");
    expect(staleCard).toHaveClass("border-border/60", "bg-surface-1/62");
    expect(staleCard).not.toHaveClass("bg-state-warning-surface/84");
    expect(within(reviewCard).getByText("該当なし")).toBeInTheDocument();
    expect(within(staleCard).getByText("該当なし")).toBeInTheDocument();
    expect(within(reviewCard).getByText("0")).toHaveClass("tabular-nums");
    expect(within(reviewCard).getByText("0").closest(".t-digit-group")).toBeNull();
    expect(within(staleCard).getByText("0").closest(".t-digit-group")).toBeNull();
  });

  it("renders non-actionable values as static sibling cards instead of filter buttons", () => {
    render(
      <SubscriptionsOverviewSummary
        cards={[
          {
            filterKey: "all",
            label: "Sync state",
            value: "Ready",
            caption: "Passive summary",
            isActive: true,
            isActionable: false,
          },
        ]}
        onSelectFilter={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: /Sync state/ })).toBeNull();

    const staticCard = getRequiredHTMLElement(
      screen.getByText("Sync state").closest("[data-subscriptions-summary-static-card]"),
      "static summary card",
    );
    expect(staticCard).not.toBeNull();
    expect(staticCard).toHaveClass("rounded-md", "shadow-none");
    expect(staticCard).not.toHaveClass("ring-[color:var(--subscriptions-summary-active-ring-neutral)]");
    expect(within(staticCard).getByText("参照")).toBeInTheDocument();
    expect(within(staticCard).getByText("Ready")).toHaveClass("text-foreground-soft");
  });

  it("uses renderValue without replacing the surrounding card structure", () => {
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
        ]}
        onSelectFilter={vi.fn()}
        renderValue={(card) => <strong data-testid="custom-summary-value">{card.value} feeds</strong>}
      />,
    );

    const card = screen.getByRole("button", { name: "Needs review を表示" });

    expect(card).toHaveClass("rounded-md", "w-full");
    expect(within(card).getByTestId("subscriptions-summary-card-badge-slot")).toBeInTheDocument();
    expect(within(card).getByTestId("custom-summary-value")).toHaveTextContent("2 feeds");
    expect(within(card).getByText("絞り込む").closest("[data-label-chip]")).toBeInTheDocument();
  });
});
