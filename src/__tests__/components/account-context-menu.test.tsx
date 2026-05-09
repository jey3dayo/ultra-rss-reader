import { ContextMenu } from "@base-ui/react/context-menu";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AccountContextMenuContent } from "@/components/reader/account-context-menu";

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
});
