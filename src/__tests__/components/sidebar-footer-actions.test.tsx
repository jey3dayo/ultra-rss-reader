import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SidebarFooterActions } from "@/components/reader/sidebar-footer-actions";

describe("SidebarFooterActions", () => {
  it("uses the RSS icon for the subscriptions index action", () => {
    render(
      <SidebarFooterActions
        subscriptionsIndexLabel="購読一覧"
        settingsLabel="設定"
        onOpenSubscriptionsIndex={vi.fn()}
        onOpenSettings={vi.fn()}
      />,
    );

    const subscriptionsButton = screen.getByRole("button", { name: "購読一覧" });
    const settingsButton = screen.getByRole("button", { name: "設定" });

    expect(subscriptionsButton.querySelector("svg.lucide-rss")).toBeInTheDocument();
    expect(settingsButton.querySelector("svg.lucide-settings")).toBeInTheDocument();
  });
});
