import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SubscriptionsOverviewSummary } from "@/components/subscriptions-index/subscriptions-overview-summary";

describe("SubscriptionsOverviewSummary", () => {
  it("uses semantic soft foreground text and neutral action chips", () => {
    render(
      <SubscriptionsOverviewSummary
        cards={[
          {
            label: "Needs review",
            value: "2",
            caption: "Check these feeds",
            actionLabel: "Review now",
            onAction: vi.fn(),
            tone: "review",
          },
          {
            label: "Healthy",
            value: "5",
            caption: "All good",
          },
        ]}
      />,
    );

    const summarySection = screen.getByRole("button", { name: /Needs review/ }).closest("section");
    expect(summarySection).not.toBeNull();
    expect(summarySection).toHaveClass("rounded-lg", "border-border/55");
    expect(summarySection).toHaveStyle({ backgroundColor: "var(--subscriptions-summary-surface)" });
    expect(summarySection?.querySelector(".grid")).toHaveClass("grid-cols-1", "gap-3");

    const actionableCard = screen.getByRole("button", { name: /Needs review/ });
    expect(within(actionableCard).getByText("Needs review")).toHaveClass("text-foreground-soft");
    expect(within(actionableCard).getByText("Check these feeds")).toHaveClass("text-foreground-soft");
    expect(within(actionableCard).getByText("Review now").closest("span")).toHaveAttribute(
      "data-label-chip",
      "neutral",
    );

    const neutralCard = screen.getByText("Healthy").closest("div");
    expect(neutralCard).not.toBeNull();
    expect(within(neutralCard as HTMLElement).getByText("Healthy")).toHaveClass("text-foreground-soft");
    expect(within(neutralCard as HTMLElement).getByText("All good")).toHaveClass("text-foreground-soft");
  });
});
