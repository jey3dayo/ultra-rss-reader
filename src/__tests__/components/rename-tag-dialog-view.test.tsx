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
    expect(screen.getByLabelText("Name")).toHaveValue("Work");
    expect(screen.getByLabelText("Name")).toHaveClass("h-9");
    expect(screen.getByRole("button", { name: "Save" })).toHaveClass("min-h-11");
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveClass("min-h-11");

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Fresh" },
    });
    await user.click(screen.getByRole("button", { name: "Save" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

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

    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    expect(screen.queryByText("Tag already exists")).not.toBeInTheDocument();
  });

  it("disables color selection while saving", async () => {
    const user = userEvent.setup();
    const onColorChange = vi.fn();

    render(
      <RenameTagDialogView
        open={true}
        name="Work"
        color={null}
        loading
        onOpenChange={vi.fn()}
        onNameChange={vi.fn()}
        onColorChange={onColorChange}
        colorOptions={["#ef4444", "#3b82f6"]}
        noColorLabel="No color"
        onSubmit={vi.fn()}
      />,
    );

    const red = screen.getByRole("radio", { name: "Color #ef4444" });

    expect(red).toBeDisabled();

    await user.click(red);

    expect(onColorChange).not.toHaveBeenCalled();
  });

  it("cleans up the pending autofocus frame when the dialog closes", () => {
    const scheduledFrames: FrameRequestCallback[] = [];
    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn((callback: FrameRequestCallback) => {
        scheduledFrames.push(callback);
        return 7;
      }),
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
    const input = screen.getByLabelText("Name") as HTMLInputElement;
    const focusSpy = vi.spyOn(input, "focus");
    const selectSpy = vi.spyOn(input, "select");

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
    const scheduledFrame = scheduledFrames[0];
    if (!scheduledFrame) {
      throw new Error("expected requestAnimationFrame callback to be scheduled");
    }
    scheduledFrame(0);
    expect(focusSpy).not.toHaveBeenCalled();
    expect(selectSpy).not.toHaveBeenCalled();
  });
});
