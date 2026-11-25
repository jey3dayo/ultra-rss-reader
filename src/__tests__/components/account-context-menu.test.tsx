import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AccountContextMenuContent } from "@/components/reader/account-context-menu";
import { ContextMenu } from "@/design-system/context-menu";

describe("AccountContextMenuContent", () => {
  it("maps the account settings item to its action id and handler", async () => {
    const user = userEvent.setup();
    const onOpenSettings = vi.fn();

    render(
      <ContextMenu.Root open>
        <AccountContextMenuContent settingsLabel="Account settings" onOpenSettings={onOpenSettings} />
      </ContextMenu.Root>,
    );

    const settingsItem = screen.getByRole("menuitem", { name: "Account settings" });
    await user.click(settingsItem);

    expect(settingsItem).toHaveAttribute("data-action-id", "account-open-settings");
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });

  it("renders the subscriptions item only when its handler is provided", async () => {
    const user = userEvent.setup();
    const onOpenSubscriptions = vi.fn();

    render(
      <ContextMenu.Root open>
        <AccountContextMenuContent
          settingsLabel="Account settings"
          onOpenSettings={vi.fn()}
          subscriptionsLabel="Open subscriptions index"
          onOpenSubscriptions={onOpenSubscriptions}
        />
      </ContextMenu.Root>,
    );

    const subscriptionsItem = screen.getByRole("menuitem", { name: "Open subscriptions index" });
    await user.click(subscriptionsItem);

    expect(subscriptionsItem).toHaveAttribute("data-action-id", "account-open-subscriptions-index");
    expect(onOpenSubscriptions).toHaveBeenCalledTimes(1);
  });
});
