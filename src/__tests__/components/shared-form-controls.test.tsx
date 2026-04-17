import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { FormActionButtons } from "@/components/shared/form-action-buttons";
import { LabeledInputRow } from "@/components/shared/labeled-input-row";
import { LabeledSelectRow } from "@/components/shared/labeled-select-row";
import { LabeledSwitchRow } from "@/components/shared/labeled-switch-row";
import { createWrapper } from "../../../tests/helpers/create-wrapper";

describe("shared form controls", () => {
  it("renders form action buttons with loading and disabled states", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    const onSubmit = vi.fn();

    const { rerender } = render(
      <div className="flex gap-2">
        <FormActionButtons
          cancelLabel="Cancel"
          submitLabel="Save"
          submittingLabel="Saving"
          onCancel={onCancel}
          onSubmit={onSubmit}
        />
      </div>,
    );

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledTimes(1);

    rerender(
      <div className="flex gap-2">
        <FormActionButtons
          cancelLabel="Cancel"
          submitLabel="Save"
          submittingLabel="Saving"
          loading={true}
          cancelDisabled={true}
          submitDisabled={true}
          onCancel={onCancel}
          onSubmit={onSubmit}
        />
      </div>,
    );

    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Saving" })).toBeDisabled();
  });

  it("associates labeled input rows with their input and inline action", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onAction = vi.fn();

    render(
      <LabeledInputRow
        label="Server URL"
        name="server-url"
        value="https://example.com/rss"
        onChange={onChange}
        actionLabel="Reset"
        actionVariant="ghost"
        onAction={onAction}
      />,
    );

    expect(screen.getByRole("textbox", { name: "Server URL" })).toHaveValue("https://example.com/rss");
    expect(screen.getByRole("button", { name: "Reset: Server URL" })).toHaveClass("text-foreground-soft");
    expect(
      screen.getByRole("textbox", { name: "Server URL" }).closest("div.flex.w-full.items-center.gap-2"),
    ).toHaveClass("sm:max-w-[30rem]", "sm:justify-end");

    await user.click(screen.getByRole("button", { name: "Reset: Server URL" }));

    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it("renders inside helper actions with foreground-soft utility treatment", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onAction = vi.fn();

    render(
      <LabeledInputRow
        label="Server URL"
        name="server-url"
        value="https://example.com/rss"
        onChange={onChange}
        actionLabel="Copy"
        actionTooltipLabel="Copy server URL"
        actionIcon={<span aria-hidden="true">⧉</span>}
        actionPlacement="inside"
        actionVariant="ghost"
        actionSize="icon-sm"
        onAction={onAction}
      />,
    );

    const actionButton = screen.getByRole("button", { name: "Copy: Server URL" });
    expect(actionButton).toHaveClass("text-foreground-soft");
    expect(actionButton).not.toHaveClass("text-muted-foreground");

    await user.click(actionButton);

    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it("exposes select and switch rows with label-driven accessible names", async () => {
    const user = userEvent.setup();
    const onSelectChange = vi.fn();
    const onSwitchChange = vi.fn();

    render(
      <>
        <LabeledSelectRow
          label="Account type"
          name="account-type"
          value="freshrss"
          options={[
            { value: "freshrss", label: "FreshRSS" },
            { value: "feedbin", label: "Feedbin" },
          ]}
          onChange={onSelectChange}
        />
        <LabeledSwitchRow label="Open links in background" checked={false} onChange={onSwitchChange} />
      </>,
      { wrapper: createWrapper() },
    );

    const combobox = screen.getByRole("combobox", { name: "Account type" });
    const switchControl = screen.getByRole("switch", { name: "Open links in background" });
    expect(combobox).toHaveTextContent("FreshRSS");
    expect(combobox).toHaveClass("sm:w-[220px]");
    expect(switchControl.parentElement).toHaveClass("sm:justify-end");

    await user.click(combobox);
    await user.click(await screen.findByRole("option", { name: "Feedbin" }));
    await user.click(switchControl);

    expect(onSelectChange).toHaveBeenCalledWith("feedbin");
    expect(onSwitchChange).toHaveBeenCalledWith(true);
  });
});
