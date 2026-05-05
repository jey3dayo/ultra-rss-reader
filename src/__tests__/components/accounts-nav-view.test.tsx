import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AccountsNavView, resolveAccountDescription } from "@/components/settings/accounts-nav-view";
import type { AccountNavItem } from "@/components/settings/settings-nav.types";

describe("AccountsNavView", () => {
  it("resolves account descriptions for multiple accounts", () => {
    expect(
      resolveAccountDescription(
        {
          id: "acc-1",
          name: "FreshRSS",
          kind: "freshrss",
          username: "alice",
          serverUrl: "https://freshrss.example.com/api/greader.php",
          isActive: false,
        },
        true,
      ),
    ).toBe("alice");
    expect(
      resolveAccountDescription(
        {
          id: "acc-2",
          name: "debug",
          kind: "freshrss",
          username: "debug",
          serverUrl: "https://feeds.example.com/api/greader.php",
          isActive: false,
        },
        true,
      ),
    ).toBe("feeds.example.com");
    expect(
      resolveAccountDescription(
        {
          id: "acc-3",
          name: "Archive",
          kind: "local",
          isActive: false,
        },
        true,
      ),
    ).toBeNull();
  });

  it("does not resolve account descriptions for a single account", () => {
    expect(
      resolveAccountDescription(
        {
          id: "acc-1",
          name: "FreshRSS",
          kind: "freshrss",
          username: "alice",
          serverUrl: "https://freshrss.example.com/api/greader.php",
          isActive: true,
        },
        false,
      ),
    ).toBeNull();
  });

  it("hides account descriptions when there is only one account", () => {
    render(
      <AccountsNavView
        accounts={[
          {
            id: "acc-1",
            name: "FreshRSS",
            kind: "freshrss",
            username: "alice",
            serverUrl: "https://freshrss.example.com/api/greader.php",
            isActive: true,
          },
        ]}
        addAccountLabel="Add account…"
        isAddAccountActive={false}
        onSelectAccount={vi.fn()}
        onAddAccount={vi.fn()}
      />,
    );

    const accountButton = screen.getByRole("button", { name: /^FreshRSS$/i });

    expect(within(accountButton).queryByText("alice", { exact: true })).not.toBeInTheDocument();
    expect(within(accountButton).queryByText("freshrss.example.com", { exact: true })).not.toBeInTheDocument();
  });

  it("shows account descriptions only when multiple accounts need disambiguation", () => {
    const onSelectAccount = vi.fn();
    const onAddAccount = vi.fn();
    const accounts: AccountNavItem[] = [
      { id: "acc-1", name: "Local", kind: "local", isActive: true },
      {
        id: "acc-2",
        name: "FreshRSS",
        kind: "FrEsHrSs",
        username: "alice",
        serverUrl: "https://freshrss.example.com/api/greader.php",
        isActive: false,
      },
      {
        id: "acc-3",
        name: "debug",
        kind: "unknown",
        username: "debug",
        serverUrl: "https://feeds.example.com/api/greader.php",
        isActive: false,
      },
      { id: "acc-4", name: "Archive", kind: "unknown", isActive: false },
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

    const localButton = screen.getByRole("button", { name: /^Local$/i });
    const freshRssButton = screen.getByRole("button", { name: /^FreshRSS alice$/i });
    const debugButton = screen.getByRole("button", { name: /^debug feeds\.example\.com$/i });
    const archiveButton = screen.getByRole("button", { name: /^Archive$/i });
    const addAccountButton = screen.getByRole("button", { name: "Add account…" });

    expect(within(localButton).getAllByText("Local", { exact: true })).toHaveLength(1);
    expect(within(freshRssButton).getByText("alice", { exact: true })).toHaveClass("text-sidebar-foreground/38");
    expect(within(freshRssButton).queryByText("FrEsHrSs", { exact: true })).not.toBeInTheDocument();
    expect(within(debugButton).getByText("feeds.example.com", { exact: true })).toHaveClass(
      "text-sidebar-foreground/38",
    );
    expect(within(localButton).queryByText("Local", { exact: true })).toBeInTheDocument();
    expect(within(archiveButton).queryByText("Account", { exact: true })).not.toBeInTheDocument();
    expect(localButton).toHaveClass("rounded-md");
    expect(localButton).toHaveClass("shrink-0");
    expect(localButton).toHaveClass("text-[13px]");
    expect(localButton).toHaveClass("focus-visible:ring-0");
    expect(freshRssButton).toHaveClass("rounded-md");
    expect(freshRssButton).toHaveClass("shrink-0");
    expect(debugButton).toHaveClass("rounded-md");
    expect(debugButton).toHaveClass("shrink-0");
    expect(addAccountButton).toHaveClass("rounded-md");
    expect(addAccountButton).toHaveClass("shrink-0");
    expect(localButton).toHaveAttribute("aria-pressed", "true");
    expect(freshRssButton).toHaveAttribute("aria-pressed", "false");
    expect(addAccountButton).toHaveAttribute("aria-pressed", "false");
    expect(localButton.querySelector("span")?.className).toContain("h-7");
    expect(freshRssButton.querySelector("span")?.className).toContain("w-7");
    expect(debugButton.querySelector("span")?.className).toContain("bg-surface-1/72");
    expect(within(freshRssButton).getByText("alice")).toHaveClass("text-sidebar-foreground/38");
    expect(localButton).toHaveClass("w-auto");
    expect(localButton).toHaveClass("before:left-0", "before:w-1.5", "before:bg-border-strong", "shadow-none");
    expect(localButton.parentElement).toHaveClass("flex");
    expect(localButton.parentElement).toHaveClass("flex-wrap");
    expect(localButton.parentElement).toHaveClass("overflow-visible");

    fireEvent.click(freshRssButton);
    fireEvent.click(addAccountButton);

    expect(onSelectAccount).toHaveBeenCalledWith("acc-2");
    expect(onAddAccount).toHaveBeenCalledOnce();
  });
});
