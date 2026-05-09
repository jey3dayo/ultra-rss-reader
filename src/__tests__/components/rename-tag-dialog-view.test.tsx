import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RenameTagDialogView } from "@/components/reader/rename-tag-dialog-view";

describe("RenameTagDialogView", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the rename dialog and delegates interactions", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const onNameChange = vi.fn();
    const onSubmit = vi.fn();

    render(
      <RenameTagDialogView
        open={true}
        name="Work"
        color={null}
        loading={false}
        onOpenChange={onOpenChange}
        onNameChange={onNameChange}
        onColorChange={vi.fn()}
        colorOptions={["#ef4444", "#3b82f6"]}
        noColorLabel="No color"
        onSubmit={onSubmit}
      />,
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByLabelText("name")).toHaveValue("Work");
    expect(screen.getByRole("button", { name: "save" })).toHaveClass("min-h-11");
    expect(screen.getByRole("button", { name: "cancel" })).toHaveClass("min-h-11");

    fireEvent.change(screen.getByLabelText("name"), {
      target: { value: "Fresh" },
    });
    await user.click(screen.getByRole("button", { name: "save" }));
    await user.click(screen.getByRole("button", { name: "cancel" }));

    expect(onNameChange).toHaveBeenLastCalledWith("Fresh");
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("disables saving for blank names without rendering inline errors", () => {
    render(
      <RenameTagDialogView
        open={true}
        name="   "
        color={null}
        loading={false}
        onOpenChange={vi.fn()}
        onNameChange={vi.fn()}
        onColorChange={vi.fn()}
        colorOptions={["#ef4444", "#3b82f6"]}
        noColorLabel="No color"
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "save" })).toBeDisabled();
    expect(screen.queryByText("Tag already exists")).not.toBeInTheDocument();
  });

  it("cleans up the pending autofocus frame when the dialog closes", () => {
    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn((_callback: FrameRequestCallback) => 7),
    );
    const cancelAnimationFrame = vi.fn();
    vi.stubGlobal("cancelAnimationFrame", cancelAnimationFrame);

    const { rerender } = render(
      <RenameTagDialogView
        open={true}
        name="Work"
        color={null}
        loading={false}
        onOpenChange={vi.fn()}
        onNameChange={vi.fn()}
        onColorChange={vi.fn()}
        colorOptions={["#ef4444", "#3b82f6"]}
        noColorLabel="No color"
        onSubmit={vi.fn()}
      />,
    );

    rerender(
      <RenameTagDialogView
        open={false}
        name="Work"
        color={null}
        loading={false}
        onOpenChange={vi.fn()}
        onNameChange={vi.fn()}
        onColorChange={vi.fn()}
        colorOptions={["#ef4444", "#3b82f6"]}
        noColorLabel="No color"
        onSubmit={vi.fn()}
      />,
    );

    expect(cancelAnimationFrame).toHaveBeenCalledWith(7);
  });
});
