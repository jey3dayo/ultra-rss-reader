import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { AccountSwitcherView } from "@/components/reader/account-switcher-view";
import { sampleAccounts } from "../../../tests/helpers/tauri-mocks";

describe("AccountSwitcherView", () => {
  it("renders an expandable account menu and selects an account", async () => {
    const user = userEvent.setup();
    const triggerRef = createRef<HTMLButtonElement>();
    const itemRefs = { current: [] as Array<HTMLButtonElement | null> };
    const onToggle = vi.fn();
    const onSelectAccount = vi.fn();
    const onClose = vi.fn();

    render(
      <AccountSwitcherView
        title="Ultra RSS"
        lastSyncedLabel="Not synced yet"
        accounts={sampleAccounts}
        accountStatusLabels={{ "acc-2": "Retrying at 12:15" }}
        selectedAccountId="acc-1"
        isExpanded={true}
        menuId="account-menu"
        menuLabel="Accounts"
        triggerRef={triggerRef}
        itemRefs={itemRefs}
        onToggle={onToggle}
        onSelectAccount={onSelectAccount}
        onClose={onClose}
      />,
    );

    expect(screen.getByRole("button", { name: /Local/ })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: /Local/ })).toHaveClass("select-none");
    expect(screen.getByRole("menu", { name: "Accounts" })).toBeInTheDocument();
    expect(screen.getAllByRole("menuitemradio")).toHaveLength(2);
    expect(screen.getByRole("heading", { name: "Local" }).querySelector(".lucide-chevron-down")).toHaveClass(
      "text-foreground-soft",
    );
    expect(screen.getByText("Retrying at 12:15")).toBeInTheDocument();

    await user.click(screen.getByRole("menuitemradio", { name: /FreshRSS/ }));

    expect(onSelectAccount).toHaveBeenCalledWith("acc-2");
    expect(onClose).toHaveBeenCalledWith(false);
    expect(onToggle).not.toHaveBeenCalled();
  });

  it("supports arrow key roving and Escape close behavior", () => {
    const triggerRef = createRef<HTMLButtonElement>();
    const itemRefs = { current: [] as Array<HTMLButtonElement | null> };
    const onToggle = vi.fn();
    const onSelectAccount = vi.fn();
    const onClose = vi.fn();

    render(
      <AccountSwitcherView
        title="Ultra RSS"
        lastSyncedLabel="Not synced yet"
        accounts={sampleAccounts}
        accountStatusLabels={{}}
        selectedAccountId="acc-1"
        isExpanded={true}
        menuId="account-menu"
        menuLabel="Accounts"
        triggerRef={triggerRef}
        itemRefs={itemRefs}
        onToggle={onToggle}
        onSelectAccount={onSelectAccount}
        onClose={onClose}
      />,
    );

    const menu = screen.getByRole("menu", { name: "Accounts" });
    const firstItem = screen.getByRole("menuitemradio", { name: /Local/ });
    const secondItem = screen.getByRole("menuitemradio", { name: /FreshRSS/ });

    expect(screen.getByRole("button", { name: /Local/ })).toBeInTheDocument();
    expect(screen.getByText("Not synced yet")).toHaveClass("text-foreground-soft");
    firstItem.focus();
    fireEvent.keyDown(menu, { key: "ArrowDown" });
    expect(secondItem).toHaveFocus();

    fireEvent.keyDown(menu, { key: "Escape" });
    expect(onClose).toHaveBeenCalledWith(true);
  });
});
