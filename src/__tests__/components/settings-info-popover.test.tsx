import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { FormEvent } from "react";
import { describe, expect, it, vi } from "vitest";
import { LabeledSwitchRow, SettingsInfoPopover } from "@/design-system";

describe("SettingsInfoPopover", () => {
  it("opens by pointer, keyboard, and touch without submitting or changing its setting", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onSubmit = vi.fn((event: FormEvent<HTMLFormElement>) => event.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <LabeledSwitchRow
          label="Sync articles"
          description="Choose how this account is updated."
          checked={false}
          onChange={onChange}
          labelAccessory={
            <SettingsInfoPopover
              title="Sync details"
              content="The account is checked for new articles during each sync."
              ariaLabel="About article syncing"
            />
          }
        />
        <button type="submit">Save</button>
      </form>,
    );

    const info = screen.getByRole("button", { name: "About article syncing" });
    const toggle = screen.getByRole("switch", { name: "Sync articles" });

    expect(info).toHaveAttribute("type", "button");
    expect(info).toHaveAttribute("aria-expanded", "false");
    await user.click(info);
    let popup = await screen.findByRole("dialog", { name: "Sync details" });
    const description = screen.getByText("The account is checked for new articles during each sync.");
    expect(info).toHaveAttribute("aria-controls", popup.id);
    expect(info).toHaveAttribute("aria-describedby", description.id);
    expect(popup).toHaveAttribute("aria-describedby", description.id);
    expect(info.closest("form")).not.toContainElement(popup);
    expect(onChange).not.toHaveBeenCalled();
    expect(toggle).toHaveAttribute("aria-checked", "false");
    expect(onSubmit).not.toHaveBeenCalled();

    await user.keyboard("{Enter}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await user.keyboard(" ");
    popup = await screen.findByRole("dialog", { name: "Sync details" });
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(info).toHaveFocus();

    await user.pointer([{ keys: "[TouchA>]", target: info }, { keys: "[/TouchA]" }]);
    expect(await screen.findByRole("dialog", { name: "Sync details" })).toBeVisible();
    await user.click(info);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(onChange).not.toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("keeps help available when the setting is disabled", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <LabeledSwitchRow
        label="Sync articles"
        checked={false}
        onChange={onChange}
        disabled
        labelAccessory={
          <SettingsInfoPopover
            title="Sync details"
            content="The setting can be enabled after connecting an account."
            ariaLabel="About article syncing"
          />
        }
      />,
    );

    const info = screen.getByRole("button", { name: "About article syncing" });
    const toggle = screen.getByRole("switch", { name: "Sync articles" });
    expect(toggle).toHaveAttribute("aria-disabled", "true");
    expect(info).not.toBeDisabled();
    await user.click(info);
    expect(await screen.findByRole("dialog", { name: "Sync details" })).toBeVisible();
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-checked", "false");
    expect(onChange).not.toHaveBeenCalled();
  });
});
