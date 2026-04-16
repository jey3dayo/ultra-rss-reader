import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SmartViewsView } from "@/components/reader/smart-views-view";

describe("SmartViewsView", () => {
  it("renders unread and starred actions with counts", async () => {
    const user = userEvent.setup();
    const onSelectSmartView = vi.fn();

    render(
      <SmartViewsView
        title="Smart views"
        views={[
          { kind: "unread", label: "Unread", count: 12, showCount: true, isSelected: true },
          { kind: "starred", label: "Starred", count: 3, showCount: true, isSelected: false },
        ]}
        onSelectSmartView={onSelectSmartView}
      />,
    );

    expect(screen.getByText("Smart views")).toBeInTheDocument();
    expect(screen.getByText("Smart views")).toHaveClass("text-[var(--sidebar-foreground-soft-strong)]");

    const unreadButton = screen.getByRole("button", { name: /Unread/ });
    const starredButton = screen.getByRole("button", { name: /Starred/ });

    expect(unreadButton).toHaveAttribute("aria-pressed", "true");
    expect(starredButton).toHaveAttribute("aria-pressed", "false");
    expect(unreadButton).toHaveClass("w-full");
    expect(starredButton).toHaveClass("w-full");
    expect(unreadButton).toHaveClass(
      "bg-[color-mix(in_srgb,var(--smart-tone)_var(--tone-surface-strength),transparent)]",
    );
    expect(unreadButton).toHaveClass(
      "text-[color-mix(in_srgb,var(--smart-tone)_var(--tone-foreground-strength),var(--sidebar-selection-foreground))]",
    );
    expect(unreadButton).toHaveClass("before:bg-primary/85");
    expect(unreadButton).toHaveStyle("--smart-tone: var(--tone-unread)");
    expect(starredButton).toHaveClass(
      "hover:text-[color-mix(in_srgb,var(--smart-tone)_var(--tone-foreground-strength),var(--sidebar-selection-foreground))]",
    );
    expect(starredButton).toHaveStyle("--smart-tone: var(--tone-starred)");
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("12")).toHaveClass(
      "text-[color-mix(in_srgb,var(--smart-tone)_var(--tone-foreground-strength),var(--sidebar-selection-foreground))]",
      "opacity-80",
    );
    expect(screen.getByText("3")).toHaveClass("text-[var(--sidebar-foreground-muted-strong)]");

    await user.click(starredButton);
    expect(onSelectSmartView).toHaveBeenCalledWith("starred");
  });
});
