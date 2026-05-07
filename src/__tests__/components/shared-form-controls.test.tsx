import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { FormActionButtons } from "@/components/shared/form-action-buttons";
import { FormDialogShell } from "@/components/shared/form-dialog-shell";
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

  it("renders the shared form dialog shell with separated header, body, and footer", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const onSubmit = vi.fn();

    render(
      <FormDialogShell
        open={true}
        title="Edit feed"
        description="Adjust the feed settings."
        cancelLabel="Cancel"
        submitLabel="Save"
        submittingLabel="Saving"
        onOpenChange={onOpenChange}
        onSubmit={onSubmit}
      >
        <LabeledInputRow label="Feed URL" name="feed-url" value="" onChange={vi.fn()} />
      </FormDialogShell>,
    );

    const dialog = screen.getByRole("dialog", { name: "Edit feed" });
    expect(dialog).toHaveClass("rounded-xl", "bg-surface-2", "shadow-elevation-3");
    expect(screen.getByText("Adjust the feed settings.")).toHaveClass("text-foreground-soft");
    expect(screen.getByRole("button", { name: "Save" }).closest('[data-slot="dialog-footer"]')).toHaveClass(
      "border-t",
      "bg-surface-1/72",
    );

    await user.click(screen.getByRole("button", { name: "Save" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
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

  it("renders inside text actions with the shared compact treatment", () => {
    render(
      <LabeledInputRow
        label="Feed URL"
        name="feed-url"
        value=""
        onChange={vi.fn()}
        placeholder="https://example.com/feed.xml"
        actionLabel="Discover"
        actionAriaLabel="Discover feed"
        actionPlacement="inside"
        onAction={vi.fn()}
      />,
    );

    const input = screen.getByRole("textbox", { name: "Feed URL" });
    const actionButton = screen.getByRole("button", { name: "Discover feed" });

    expect(input).toHaveClass("pr-20");
    expect(actionButton).toHaveClass("absolute", "right-1", "h-7", "min-w-14", "px-2", "text-xs");
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
    expect(combobox).toHaveClass("sm:w-[220px]", "motion-reduce:transition-none");
    expect(switchControl.parentElement).toHaveClass("sm:justify-end");
    expect(switchControl).toHaveClass("motion-reduce:transition-none");

    await user.click(combobox);
    await user.click(await screen.findByRole("option", { name: "Feedbin" }));
    await user.click(switchControl);

    expect(onSelectChange).toHaveBeenCalledWith("feedbin");
    expect(onSwitchChange).toHaveBeenCalledWith(true);
  });

  it("keeps unknown select values visible as their raw value", () => {
    render(
      <LabeledSelectRow
        label="Display mode"
        name="display-mode"
        value="custom"
        options={[
          { value: "standard", label: "Standard" },
          { value: "preview", label: "Preview" },
        ]}
        onChange={vi.fn()}
      />,
      { wrapper: createWrapper() },
    );

    expect(screen.getByRole("combobox", { name: "Display mode" })).toHaveTextContent("custom");
  });
});
