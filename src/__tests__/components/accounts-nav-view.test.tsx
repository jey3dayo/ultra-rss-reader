import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AccountsNavView } from "@/components/settings/accounts-nav-view";
import type { AccountNavItem } from "@/components/settings/settings-nav.types";

describe("AccountsNavView", () => {
  it("renders account rows and add-account action from props", () => {
    const onSelectAccount = vi.fn();
    const onAddAccount = vi.fn();
    const accounts: AccountNavItem[] = [
      { id: "acc-1", name: "Local", kind: "local", isActive: true },
      { id: "acc-2", name: "FreshRSS", kind: "freshrss", isActive: false },
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
    const freshRssButton = screen.getByRole("button", { name: /FreshRSS/i });
    const addAccountButton = screen.getByRole("button", { name: "Add account…" });

    expect(localButton).toHaveClass("bg-[var(--bg-selected)]");
    expect(localButton).toHaveClass("shadow-none");
    expect(localButton).toHaveClass("before:bg-primary");
    expect(localButton).toHaveAttribute("aria-pressed", "true");
    expect(freshRssButton).not.toHaveClass("bg-[var(--bg-selected)]");
    expect(freshRssButton).toHaveAttribute("aria-pressed", "false");
    expect(addAccountButton).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(freshRssButton);
    fireEvent.click(addAccountButton);

    expect(onSelectAccount).toHaveBeenCalledWith("acc-2");
    expect(onAddAccount).toHaveBeenCalledOnce();
  });
});
