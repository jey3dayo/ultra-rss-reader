import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AccountSwitcherMenu } from "@/components/reader/account-switcher-menu";
import { sampleAccounts } from "../../../tests/helpers/tauri-mocks";

describe("AccountSwitcherMenu", () => {
  it("renders the selected account with the emphasized sidebar pattern and delegates clicks", async () => {
    const user = userEvent.setup();
    const onSelectAccount = vi.fn();
    const onClose = vi.fn();
    const itemRefs = { current: [] as Array<HTMLButtonElement | null> };

    render(
      <AccountSwitcherMenu
        accounts={sampleAccounts}
        accountStatusLabels={{ "acc-1": "Local only" }}
        selectedAccountId="acc-1"
        menuId="account-switcher-menu"
        menuLabel="Accounts"
        itemRefs={itemRefs}
        onSelectAccount={onSelectAccount}
        onClose={onClose}
      />,
    );

    const menu = screen.getByRole("menu", { name: "Accounts" });
    const localButton = screen.getByRole("menuitemradio", { name: /Local/i });
    const freshRssButton = screen.getByRole("menuitemradio", { name: /FreshRSS/i });

    expect(menu).toHaveClass("rounded-xl");
    expect(menu).toHaveClass("bg-surface-2/90");
    expect(menu).toHaveClass("shadow-elevation-2");
    expect(localButton).toHaveClass("bg-[var(--sidebar-hover-surface)]");
    expect(localButton).toHaveClass("text-sidebar-foreground");
    expect(localButton).toHaveClass("shadow-none");
    expect(localButton).toHaveClass("focus-visible:ring-0");
    expect(localButton).toHaveAttribute("aria-checked", "true");
    expect(freshRssButton).not.toHaveClass("bg-[var(--sidebar-hover-surface)]");
    expect(freshRssButton).toHaveClass("hover:bg-[var(--sidebar-hover-surface)]");
    expect(freshRssButton).toHaveClass("text-sidebar-foreground/88");
    expect(screen.getByText("local")).toHaveClass("text-foreground-soft");
    expect(screen.getByText("Local only")).toHaveClass("text-foreground-soft");
    expect(screen.getByText("Local only")).toBeInTheDocument();

    await user.click(freshRssButton);

    expect(onSelectAccount).toHaveBeenCalledWith("acc-2");
    expect(onClose).toHaveBeenCalledWith(false);
  });
});
