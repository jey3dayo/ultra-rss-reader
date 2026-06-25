import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { sampleAccounts } from "@tests/helpers/fixtures";
import { renderStory } from "@tests/helpers/render-story";
import { createRef, type RefObject } from "react";
import { describe, expect, it, vi } from "vitest";
import { AccountSwitcherView } from "@/components/reader/account-switcher-view";
import accountSwitcherStories, {
  Expanded as AccountSwitcherExpanded,
  SingleAccount as AccountSwitcherSingleAccount,
} from "@/components/reader/account-switcher-view.stories";

function createAccountItemRefs(): RefObject<Array<HTMLButtonElement | null>> {
  const current: Array<HTMLButtonElement | null> = [];
  return { current };
}

describe("AccountSwitcherView", () => {
  it("renders an expandable account menu and selects an account", async () => {
    const user = userEvent.setup();
    const triggerRef = createRef<HTMLButtonElement>();
    const itemRefs = createAccountItemRefs();
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

    const trigger = screen.getByRole("button", { name: /Local/ });

    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(trigger).toHaveClass("select-none");
    expect(trigger).toHaveClass("rounded-md", "text-sidebar-foreground/92");
    expect(triggerRef.current).toBe(trigger);
    expect(screen.getByRole("menu", { name: "Accounts" })).toBeInTheDocument();
    expect(screen.getAllByRole("menuitemradio")).toHaveLength(2);
    expect(screen.getByRole("heading", { name: "Local" })).toHaveClass("font-medium");
    expect(screen.getByText("Not synced yet")).toHaveClass("text-[0.72rem]", "tracking-[0.04em]");
    expect(screen.getByRole("heading", { name: "Local" }).querySelector(".lucide-chevron-down")).toHaveClass(
      "text-sidebar-foreground/56",
    );
    expect(screen.getByText("Retrying at 12:15")).toBeInTheDocument();

    await user.click(screen.getByRole("menuitemradio", { name: /FreshRSS/ }));

    expect(onSelectAccount).toHaveBeenCalledWith("acc-2");
    expect(onClose).toHaveBeenCalledWith(false);
    expect(onToggle).not.toHaveBeenCalled();
  });

  it("supports arrow key roving and Escape close behavior", () => {
    const triggerRef = createRef<HTMLButtonElement>();
    const itemRefs = createAccountItemRefs();
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
    expect(screen.getByText("Not synced yet")).toHaveClass("text-sidebar-foreground/54");
    firstItem.focus();
    fireEvent.keyDown(menu, { key: "ArrowDown" });
    expect(secondItem).toHaveFocus();

    fireEvent.keyDown(menu, { key: "Escape" });
    expect(onClose).toHaveBeenCalledWith(true);
  });

  it("keeps a single selected account trigger closed without menu semantics", async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    const onClose = vi.fn();

    render(
      <AccountSwitcherView
        title="Ultra RSS"
        lastSyncedLabel="Not synced yet"
        accounts={[sampleAccounts[0]]}
        accountStatusLabels={{}}
        selectedAccountId="acc-1"
        isExpanded={false}
        menuId="account-menu"
        menuLabel="Accounts"
        triggerRef={createRef<HTMLButtonElement>()}
        itemRefs={{ current: [] }}
        onToggle={onToggle}
        onSelectAccount={vi.fn()}
        onClose={onClose}
      />,
    );

    const trigger = screen.getByRole("button", { name: /Local/ });

    expect(trigger).not.toHaveAttribute("aria-haspopup");
    expect(trigger).not.toHaveAttribute("aria-expanded");
    expect(trigger).not.toHaveAttribute("aria-controls");
    expect(screen.queryByRole("menu", { name: "Accounts" })).not.toBeInTheDocument();
    await user.click(trigger);
    expect(onToggle).not.toHaveBeenCalled();
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    fireEvent.keyDown(trigger, { key: "Escape" });
    expect(onToggle).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("ignores stale expanded state for a single selected account", () => {
    const itemRefs = createAccountItemRefs();
    const onClose = vi.fn();
    const onToggle = vi.fn();

    render(
      <AccountSwitcherView
        title="Ultra RSS"
        lastSyncedLabel="Not synced yet"
        accounts={[sampleAccounts[0]]}
        accountStatusLabels={{}}
        selectedAccountId="acc-1"
        isExpanded={true}
        menuId="account-menu"
        menuLabel="Accounts"
        triggerRef={createRef<HTMLButtonElement>()}
        itemRefs={itemRefs}
        onToggle={onToggle}
        onSelectAccount={vi.fn()}
        onClose={onClose}
      />,
    );

    const trigger = screen.getByRole("button", { name: /Local/ });

    fireEvent.keyDown(trigger, { key: "Escape" });
    fireEvent.keyDown(trigger, { key: "ArrowDown" });

    expect(onClose).not.toHaveBeenCalled();
    expect(onToggle).not.toHaveBeenCalled();
    expect(trigger).not.toHaveAttribute("aria-haspopup");
    expect(trigger).not.toHaveAttribute("aria-expanded");
    expect(trigger).not.toHaveAttribute("aria-controls");
    expect(screen.queryByRole("menu", { name: "Accounts" })).not.toBeInTheDocument();
    expect(itemRefs.current).toEqual([]);
  });

  it("uses the title fallback and disables menu semantics when accounts are empty", async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();

    render(
      <AccountSwitcherView
        title="Ultra RSS"
        lastSyncedLabel="Not synced yet"
        accounts={[]}
        accountStatusLabels={{}}
        selectedAccountId={null}
        isExpanded={false}
        menuId="account-menu"
        menuLabel="Accounts"
        triggerRef={createRef<HTMLButtonElement>()}
        itemRefs={{ current: [] }}
        onToggle={onToggle}
        onSelectAccount={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    const trigger = screen.getByRole("button", { name: /Ultra RSS/ });

    expect(trigger).not.toHaveAttribute("aria-haspopup");
    expect(trigger).not.toHaveAttribute("aria-expanded");
    expect(trigger).not.toHaveAttribute("aria-controls");
    await user.click(trigger);
    expect(onToggle).not.toHaveBeenCalled();
  });

  it("uses the title fallback and disables menu semantics when selected account is missing", async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();

    render(
      <AccountSwitcherView
        title="Ultra RSS"
        lastSyncedLabel="Not synced yet"
        accounts={sampleAccounts}
        accountStatusLabels={{}}
        selectedAccountId="missing-account"
        isExpanded={false}
        menuId="account-menu"
        menuLabel="Accounts"
        triggerRef={createRef<HTMLButtonElement>()}
        itemRefs={{ current: [] }}
        onToggle={onToggle}
        onSelectAccount={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    const trigger = screen.getByRole("button", { name: /Ultra RSS/ });

    expect(trigger).not.toHaveAttribute("aria-haspopup");
    expect(trigger).not.toHaveAttribute("aria-expanded");
    expect(trigger).not.toHaveAttribute("aria-controls");
    await user.click(trigger);
    expect(onToggle).not.toHaveBeenCalled();
  });

  it("keeps Storybook refs isolated from shared args", () => {
    expect(accountSwitcherStories.args).not.toHaveProperty("triggerRef");
    expect(accountSwitcherStories.args).not.toHaveProperty("itemRefs");

    renderStory(accountSwitcherStories, AccountSwitcherExpanded);
    expect(screen.getByRole("menu", { name: "Accounts" })).toBeInTheDocument();

    cleanup();
    renderStory(accountSwitcherStories, AccountSwitcherSingleAccount);
    expect(screen.queryByRole("menu", { name: "Accounts" })).not.toBeInTheDocument();
  });
});
