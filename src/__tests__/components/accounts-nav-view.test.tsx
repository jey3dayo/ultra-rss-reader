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
      { id: "acc-3", name: "Mystery feed", kind: "unknown", isActive: false },
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
    const mysteryButton = screen.getByRole("button", { name: /Mystery feed/i });
    const addAccountButton = screen.getByRole("button", { name: "Add account…" });

    expect(within(localButton).getAllByText("Local", { exact: true })).toHaveLength(1);
    expect(within(freshRssButton).getAllByText("FreshRSS", { exact: true })).toHaveLength(1);
    expect(within(freshRssButton).queryByText("FrEsHrSs", { exact: true })).not.toBeInTheDocument();
    expect(within(mysteryButton).getByText("Account", { exact: true })).toHaveClass("text-sidebar-foreground/38");
    expect(localButton).toHaveClass("rounded-md");
    expect(localButton).toHaveClass("shrink-0");
    expect(localButton).toHaveClass("text-[13px]");
    expect(localButton).toHaveClass("focus-visible:ring-0");
    expect(freshRssButton).toHaveClass("rounded-md");
    expect(freshRssButton).toHaveClass("shrink-0");
    expect(mysteryButton).toHaveClass("rounded-md");
    expect(mysteryButton).toHaveClass("shrink-0");
    expect(addAccountButton).toHaveClass("rounded-md");
    expect(addAccountButton).toHaveClass("shrink-0");
    expect(localButton).toHaveAttribute("aria-pressed", "true");
    expect(freshRssButton).toHaveAttribute("aria-pressed", "false");
    expect(addAccountButton).toHaveAttribute("aria-pressed", "false");
    expect(localButton.querySelector("span")?.className).toContain("h-7");
    expect(freshRssButton.querySelector("span")?.className).toContain("w-7");
    expect(mysteryButton.querySelector("span")?.className).toContain("bg-surface-1/72");
    expect(within(freshRssButton).getByText("FreshRSS")).toHaveClass("text-sidebar-foreground/38");
    expect(localButton.parentElement).toHaveClass("flex");
    expect(localButton.parentElement).toHaveClass("overflow-x-auto");

    fireEvent.click(freshRssButton);
    fireEvent.click(addAccountButton);

    expect(onSelectAccount).toHaveBeenCalledWith("acc-2");
    expect(onAddAccount).toHaveBeenCalledOnce();
  });
});
