import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AccountsNavView } from "@/components/settings/accounts-nav-view";
import type { AccountNavItem } from "@/components/settings/settings-nav.types";

describe("AccountsNavView", () => {
  it("renders account rows, avoids duplicate visible labels, and reports selection", () => {
    const onSelectAccount = vi.fn();
    const onAddAccount = vi.fn();
    const accounts: AccountNavItem[] = [
      { id: "acc-1", name: "Local", kind: "local", isActive: true },
      { id: "acc-2", name: "Team feed", kind: "FrEsHrSs", isActive: false },
    ];

    render(
      <AccountsNavView
        accounts={accounts}
        addAccountLabel="Add account…"
        isAddAccountActive={false}
        onSelectAccount={onSelectAccount}
        onAddAccount={onAddAccount}
      />,
    );

    const localButton = screen.getByRole("button", { name: /Local/i });
    const freshRssButton = screen.getByRole("button", { name: /Team feed/i });
    const addAccountButton = screen.getByRole("button", { name: "Add account…" });

    expect(within(localButton).getAllByText("Local", { exact: true })).toHaveLength(1);
    expect(within(freshRssButton).getAllByText("FreshRSS", { exact: true })).toHaveLength(1);
    expect(within(freshRssButton).queryByText("FrEsHrSs", { exact: true })).not.toBeInTheDocument();
    expect(localButton).toHaveClass("rounded-md");
    expect(freshRssButton).toHaveClass("rounded-md");
    expect(addAccountButton).toHaveClass("rounded-md");
    expect(localButton).toHaveAttribute("aria-pressed", "true");
    expect(freshRssButton).toHaveAttribute("aria-pressed", "false");
    expect(addAccountButton).toHaveAttribute("aria-pressed", "false");
    expect(localButton.querySelector("span")?.className).toContain("bg-orange-500");
    expect(freshRssButton.querySelector("span")?.className).toContain("bg-[#0062BE]");
    expect(within(freshRssButton).getByText("FreshRSS")).toHaveClass("text-sidebar-foreground/64");

    fireEvent.click(freshRssButton);
    fireEvent.click(addAccountButton);

    expect(onSelectAccount).toHaveBeenCalledWith("acc-2");
    expect(onAddAccount).toHaveBeenCalledOnce();
  });
});
