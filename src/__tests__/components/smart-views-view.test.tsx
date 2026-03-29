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
        unreadLabel="Unread"
        starredLabel="Starred"
        unreadCount={12}
        starredCount={3}
        showUnreadCount={true}
        showStarredCount={true}
        selectedKind="unread"
        onSelectSmartView={onSelectSmartView}
      />,
    );

    expect(screen.getByRole("button", { name: /Unread/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /Starred/ })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Starred/ }));
    expect(onSelectSmartView).toHaveBeenCalledWith("starred");
  });
});
