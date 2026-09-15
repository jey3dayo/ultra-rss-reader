import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { FormDialogShell } from "@/design-system";

/**
 * Regression coverage for the FormDialogShell Enter-to-submit contract.
 *
 * Background: FormDialogShell used to rely on HTML implicit form submission,
 * which only fires when the form contains exactly one field that blocks
 * submission. Any dialog with a second field (e.g. a "new folder" input)
 * silently broke Enter-to-submit. The fix moves the submit button inside the
 * <form> so Enter always finds a real submit control, regardless of field
 * count.
 *
 * These tests intentionally use real keyboard events (`user.keyboard`),
 * never `fireEvent.submit`, because `fireEvent.submit` bypasses the browser's
 * implicit-submission / Enter-key resolution entirely and would not have
 * caught the original bug.
 */
describe("FormDialogShell", () => {
  function renderShell(props: {
    onSubmit: () => void;
    fieldCount: 1 | 2;
    loading?: boolean;
    submitDisabled?: boolean;
  }) {
    const onOpenChange = vi.fn();

    render(
      <FormDialogShell
        open={true}
        title="Test dialog"
        cancelLabel="Cancel"
        submitLabel="Save"
        submittingLabel="Saving"
        loading={props.loading}
        submitDisabled={props.submitDisabled}
        onOpenChange={onOpenChange}
        onSubmit={props.onSubmit}
      >
        <input aria-label="First field" type="text" />
        {props.fieldCount === 2 ? <input aria-label="Second field" type="text" /> : null}
      </FormDialogShell>,
    );

    return { onOpenChange };
  }

  it("submits exactly once on Enter when the form has a single blocking field", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    renderShell({ onSubmit, fieldCount: 1 });

    await user.click(screen.getByLabelText("First field"));
    await user.keyboard("{Enter}");

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("submits exactly once on Enter when the form has two blocking fields (regression)", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    renderShell({ onSubmit, fieldCount: 2 });

    await user.click(screen.getByLabelText("First field"));
    await user.keyboard("{Enter}");

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("submits exactly once when the submit button is clicked (no double firing)", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    renderShell({ onSubmit, fieldCount: 2 });

    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("does not submit on Enter while loading", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    renderShell({ onSubmit, fieldCount: 2, loading: true });

    await user.click(screen.getByLabelText("First field"));
    await user.keyboard("{Enter}");

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("does not submit on Enter while submitDisabled", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    renderShell({ onSubmit, fieldCount: 2, submitDisabled: true });

    await user.click(screen.getByLabelText("First field"));
    await user.keyboard("{Enter}");

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("keeps the submit button as a form descendant so Enter resolves to it", () => {
    const onSubmit = vi.fn();
    renderShell({ onSubmit, fieldCount: 2 });

    const submitButton = screen.getByRole("button", { name: "Save" }) as HTMLButtonElement;
    const formElement = submitButton.closest("form");

    expect(formElement).not.toBeNull();
    expect(submitButton.form).toBe(formElement);
  });

  it("keeps the body scrollable and the footer fixed outside the scroll region", () => {
    const onSubmit = vi.fn();
    renderShell({ onSubmit, fieldCount: 1 });

    const formElement = screen.getByLabelText("First field").closest("form");
    expect(formElement).toHaveClass("flex", "min-h-0", "flex-1", "flex-col");

    const scrollRegion = screen.getByLabelText("First field").closest("div.overflow-y-auto");
    expect(scrollRegion).toHaveClass("min-h-0", "flex-1", "overflow-y-auto");

    const footer = screen.getByRole("button", { name: "Save" }).closest('[data-slot="dialog-footer"]');
    expect(footer).toHaveClass("shrink-0");
    expect(footer).not.toBe(scrollRegion);
  });
});
