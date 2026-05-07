import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SidebarFooterActions } from "@/components/reader/sidebar-footer-actions";

describe("SidebarFooterActions", () => {
  it("uses the RSS icon for the subscriptions index action", () => {
    render(
      <SidebarFooterActions
        subscriptionsIndexLabel="購読一覧"
        subscriptionsIndexShortLabel="購読"
        settingsLabel="設定"
        themeToggleLabel="テーマを切り替え"
        onOpenSubscriptionsIndex={vi.fn()}
        onOpenSettings={vi.fn()}
      />,
    );

    const subscriptionsButton = screen.getByRole("button", { name: "購読一覧" });
    const themeButton = screen.getByRole("button", { name: "テーマを切り替え" });
    const settingsButton = screen.getByRole("button", { name: "設定" });

    expect(subscriptionsButton.querySelector("svg.lucide-rss")).toBeInTheDocument();
    expect(themeButton.querySelector("svg.lucide-moon")).toBeInTheDocument();
    expect(settingsButton.querySelector("svg.lucide-settings")).toBeInTheDocument();
    expect(subscriptionsButton).toHaveTextContent("購読");
    expect(subscriptionsButton).not.toHaveTextContent("購読一覧");
    expect(subscriptionsButton).toHaveClass("h-8", "rounded-md", "border-0", "justify-start");
    expect(screen.getByText("購読")).toHaveClass("truncate");
    expect(themeButton).toHaveClass("size-8", "rounded-md", "border-0");
    expect(settingsButton).toHaveClass("size-8", "rounded-md", "border-0");
  });

  it("shows tooltips for footer actions", async () => {
    const user = userEvent.setup();

    render(
      <SidebarFooterActions
        subscriptionsIndexLabel="購読一覧"
        subscriptionsIndexShortLabel="購読"
        settingsLabel="設定"
        themeToggleLabel="テーマを切り替え"
        onOpenSubscriptionsIndex={vi.fn()}
        onOpenSettings={vi.fn()}
      />,
    );

    await user.hover(screen.getByRole("button", { name: "購読一覧" }));
    expect(await screen.findByText("購読一覧")).toHaveClass("motion-popup-surface");

    await user.hover(screen.getByRole("button", { name: "テーマを切り替え" }));
    expect(await screen.findByText("テーマを切り替え")).toHaveClass("motion-popup-surface");

    await user.hover(screen.getByRole("button", { name: "設定" }));
    expect(await screen.findByText("設定")).toHaveClass("motion-popup-surface");
  });
});
