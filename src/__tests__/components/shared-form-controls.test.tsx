import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createWrapper } from "@tests/helpers/create-wrapper";
import { describe, expect, it, vi } from "vitest";
import {
  createSelectValueChangeHandler,
  FormActionButtons,
  FormDialogShell,
  LabeledActionInputRow,
  LabeledActionSelectRow,
  LabeledInputRow,
  LabeledSelectRow,
  LabeledSwitchRow,
  LoadingActionContent,
} from "@/design-system";

describe("shared form controls", () => {
  it("renders shared loading action content with default and custom loading states", () => {
    const { rerender } = render(
      <LoadingActionContent loading={false} loadingLabel="Saving">
        Save
      </LoadingActionContent>,
    );

    expect(screen.getByText("Save")).toBeInTheDocument();
    expect(screen.queryByText("Saving")).not.toBeInTheDocument();
    expect(document.querySelector("[data-slot='loading-spinner']")).not.toBeInTheDocument();

    rerender(
      <LoadingActionContent loading={true} loadingLabel="Saving">
        Save
      </LoadingActionContent>,
    );

    expect(screen.getByText("Saving")).toBeInTheDocument();
    expect(screen.queryByText("Save")).not.toBeInTheDocument();
    expect(document.querySelector("[data-slot='loading-spinner']")).toHaveAttribute("aria-hidden", "true");

    rerender(
      <LoadingActionContent loading={true} spinner={<span data-testid="custom-spinner" aria-hidden="true" />}>
        Save
      </LoadingActionContent>,
    );

    expect(screen.getByText("Save")).toBeInTheDocument();
    expect(screen.getByTestId("custom-spinner")).toBeInTheDocument();
  });

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
    expect(screen.getByRole("button", { name: "Saving" })).toHaveAttribute("aria-busy", "true");
  });

  it("uses the submitting label only while loading and a submitting label is provided", () => {
    const props = {
      cancelLabel: "Cancel",
      submitLabel: "Save",
      onCancel: vi.fn(),
    };

    const { rerender } = render(<FormActionButtons {...props} submittingLabel="Saving" />);

    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Saving" })).not.toBeInTheDocument();

    rerender(<FormActionButtons {...props} submittingLabel="Saving" loading={true} />);

    expect(screen.getByRole("button", { name: "Saving" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();

    rerender(<FormActionButtons {...props} loading={true} />);

    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Saving" })).not.toBeInTheDocument();
  });

  it("blocks form action submit activation while loading", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(
      <FormActionButtons
        cancelLabel="Cancel"
        submitLabel="Save"
        submittingLabel="Saving"
        loading={true}
        onCancel={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    const submitButton = screen.getByRole("button", { name: "Saving" });

    expect(submitButton).toBeDisabled();
    expect(submitButton).toHaveAttribute("aria-busy", "true");

    await user.click(submitButton);

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("guards direct submit activation while loading even when submitDisabled is false", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(
      <FormActionButtons
        cancelLabel="Cancel"
        submitLabel="Save"
        submittingLabel="Saving"
        loading={true}
        submitDisabled={false}
        onCancel={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    const submitButton = screen.getByRole("button", { name: "Saving" });

    expect(submitButton).toBeDisabled();

    await user.click(submitButton);

    expect(onSubmit).not.toHaveBeenCalled();
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
    expect(dialog).toHaveClass(
      "flex",
      "max-h-[calc(100dvh-2rem)]",
      "flex-col",
      "rounded-xl",
      "bg-surface-2",
      "shadow-elevation-3",
    );
    expect(screen.getByText("Adjust the feed settings.")).toHaveClass("text-foreground-soft");
    expect(screen.getByText("Adjust the feed settings.").closest('[data-slot="dialog-header"]')).toHaveClass(
      "shrink-0",
    );
    expect(screen.getByRole("textbox", { name: "Feed URL" }).closest("form")).toHaveClass(
      "min-h-0",
      "flex-1",
      "overflow-y-auto",
    );
    expect(screen.getByRole("button", { name: "Save" }).closest('[data-slot="dialog-footer"]')).toHaveClass(
      "border-t",
      "bg-surface-1/72",
      "shrink-0",
    );

    await user.click(screen.getByRole("textbox", { name: "Feed URL" }));
    await user.keyboard("{Enter}");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onSubmit).toHaveBeenCalledTimes(2);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it.each([
    { propName: "loading", props: { loading: true } },
    { propName: "submitDisabled", props: { submitDisabled: true } },
  ])("blocks shared form dialog submit paths while $propName is active", async ({ props }) => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(
      <FormDialogShell
        open={true}
        title="Edit feed"
        cancelLabel="Cancel"
        submitLabel="Save"
        submittingLabel="Saving"
        onOpenChange={vi.fn()}
        onSubmit={onSubmit}
        {...props}
      >
        <LabeledInputRow label="Feed URL" name="feed-url" value="" onChange={vi.fn()} />
      </FormDialogShell>,
    );

    const input = screen.getByRole("textbox", { name: "Feed URL" });
    const submitButton = screen.getByRole("button", { name: props.loading ? "Saving" : "Save" });

    await user.click(input);
    await user.keyboard("{Enter}");
    await user.click(submitButton);

    expect(submitButton).toBeDisabled();
    expect(onSubmit).not.toHaveBeenCalled();
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

  it("associates labeled action input rows with their input and right-aligned trailing controls", () => {
    render(
      <LabeledActionInputRow
        label="Tag name"
        name="tag-name"
        value="News"
        onChange={vi.fn()}
        trailingControls={<button type="button">Create</button>}
      />,
    );

    const input = screen.getByRole("textbox", { name: "Tag name" });
    const createButton = screen.getByRole("button", { name: "Create" });

    expect(input).toHaveValue("News");
    expect(input.id).toBeTruthy();
    expect(document.querySelector(`label[for="${input.id}"]`)).toHaveTextContent("Tag name");
    expect(input.closest("div.flex.w-full.items-center.gap-2")).toHaveClass("sm:max-w-[30rem]", "sm:justify-end");
    expect(createButton.closest("div.flex.w-full.items-center.gap-2")).toBe(
      input.closest("div.flex.w-full.items-center.gap-2"),
    );
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

  it("keeps input focus after clicking an inside action once", async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();

    render(
      <LabeledInputRow
        label="Server URL"
        name="server-url"
        value="https://example.com/rss"
        onChange={vi.fn()}
        actionLabel="Copy"
        actionPlacement="inside"
        onAction={onAction}
      />,
    );

    const input = screen.getByRole("textbox", { name: "Server URL" }) as HTMLInputElement;
    const actionButton = screen.getByRole("button", { name: "Copy: Server URL" });

    await user.click(input);
    input.setSelectionRange(8, 19);

    await user.click(actionButton);

    expect(input).toHaveFocus();
    expect(input.selectionStart).toBe(8);
    expect(input.selectionEnd).toBe(19);
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it("disables labeled input actions by default when the input row is disabled", async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();

    render(
      <LabeledInputRow
        label="Server URL"
        name="server-url"
        value="https://example.com/rss"
        disabled
        onChange={vi.fn()}
        actionLabel="Reset"
        onAction={onAction}
      />,
    );

    const actionButton = screen.getByRole("button", { name: "Reset: Server URL" });

    expect(actionButton).toBeDisabled();

    await user.click(actionButton);

    expect(onAction).not.toHaveBeenCalled();
  });

  it("allows labeled input actions when explicitly enabled on a disabled input row", async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();

    render(
      <LabeledInputRow
        label="Server URL"
        name="server-url"
        value="https://example.com/rss"
        disabled
        actionDisabled={false}
        onChange={vi.fn()}
        actionLabel="Reset"
        onAction={onAction}
      />,
    );

    const actionButton = screen.getByRole("button", { name: "Reset: Server URL" });

    expect(actionButton).not.toBeDisabled();

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
        <LabeledSwitchRow
          label="Open links in background"
          description="Keep the reader visible when opening links."
          checked={false}
          onChange={onSwitchChange}
        />
      </>,
      { wrapper: createWrapper() },
    );

    const combobox = screen.getByRole("combobox", { name: "Account type" });
    const switchControl = screen.getByRole("switch", { name: "Open links in background" });
    expect(combobox).toHaveTextContent("FreshRSS");
    expect(combobox).toHaveClass("sm:w-[220px]", "motion-reduce:transition-none");
    expect(switchControl.parentElement).toHaveClass("sm:justify-end");
    expect(switchControl).toHaveClass("motion-reduce:transition-none");
    expect(switchControl).toHaveAccessibleDescription("Keep the reader visible when opening links.");

    await user.click(combobox);
    await user.click(await screen.findByRole("option", { name: "Feedbin" }));
    await user.click(switchControl);

    expect(onSelectChange).toHaveBeenCalledWith("feedbin");
    expect(onSwitchChange).toHaveBeenCalledWith(true);
  });

  it("exposes labeled action select rows with label-driven names and trailing controls", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();

    render(
      <LabeledActionSelectRow
        label="Mute scope"
        name="mute-scope"
        value="title"
        options={[
          { value: "title", label: "Title" },
          { value: "body", label: "Body" },
        ]}
        onValueChange={onValueChange}
        trailingControls={<button type="button">Delete</button>}
      />,
      { wrapper: createWrapper() },
    );

    const combobox = screen.getByRole("combobox", { name: "Mute scope" });
    const deleteButton = screen.getByRole("button", { name: "Delete" });

    expect(combobox).toHaveTextContent("Title");
    expect(combobox).toHaveClass("h-10", "sm:flex-1");
    expect(combobox.closest("div.flex.w-full.flex-col.gap-2")).toHaveClass("sm:max-w-[30rem]", "sm:justify-end");
    expect(deleteButton.closest("div.flex.w-full.flex-col.gap-2")).toBe(
      combobox.closest("div.flex.w-full.flex-col.gap-2"),
    );

    await user.click(combobox);
    await user.click(await screen.findByRole("option", { name: "Body" }));

    expect(onValueChange).toHaveBeenCalledWith("body");
  });

  it("does not call labeled action select change handlers while disabled", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();

    render(
      <LabeledActionSelectRow
        label="Mute scope"
        name="mute-scope"
        value="title"
        options={[
          { value: "title", label: "Title" },
          { value: "body", label: "Body" },
        ]}
        disabled
        onValueChange={onValueChange}
      />,
      { wrapper: createWrapper() },
    );

    await user.click(screen.getByRole("combobox", { name: "Mute scope" }));

    expect(screen.queryByRole("option", { name: "Body" })).not.toBeInTheDocument();
    expect(onValueChange).not.toHaveBeenCalled();
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

  it("does not call labeled select change handlers while disabled", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <LabeledSelectRow
        label="Display mode"
        name="display-mode"
        value="preview"
        options={[
          { value: "standard", label: "Standard" },
          { value: "preview", label: "Preview" },
        ]}
        disabled
        onChange={onChange}
      />,
      { wrapper: createWrapper() },
    );

    await user.click(screen.getByRole("combobox", { name: "Display mode" }));

    expect(screen.queryByRole("option", { name: "Standard" })).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("ignores disabled labeled select option clicks when the row is controlled open", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <LabeledSelectRow
        label="Display mode"
        name="display-mode"
        value="preview"
        options={[
          { value: "standard", label: "Standard" },
          { value: "preview", label: "Preview" },
        ]}
        disabled
        open
        onChange={onChange}
      />,
      { wrapper: createWrapper() },
    );

    await user.click(await screen.findByRole("option", { name: "Standard" }));

    expect(onChange).not.toHaveBeenCalled();
  });

  it("drops disabled and null labeled select values before calling change handlers", () => {
    const onChange = vi.fn();
    const enabledHandleChange = createSelectValueChangeHandler({ disabled: false, onChange });
    const disabledHandleChange = createSelectValueChangeHandler({ disabled: true, onChange });

    enabledHandleChange(null);
    disabledHandleChange("standard");

    expect(onChange).not.toHaveBeenCalled();
  });
});
