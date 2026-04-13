import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RenameTagDialogView } from "@/components/reader/rename-tag-dialog-view";

describe("RenameTagDialogView", () => {
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
    expect(screen.getByRole("button", { name: "Save" })).toHaveClass("min-h-11");
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveClass("min-h-11");

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Fresh" } });
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
});
