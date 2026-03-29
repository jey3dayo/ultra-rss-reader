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
        loading={false}
        error={null}
        onOpenChange={onOpenChange}
        onNameChange={onNameChange}
        onSubmit={onSubmit}
      />,
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toHaveValue("Work");

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Fresh" } });
    await user.click(screen.getByRole("button", { name: "Save" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onNameChange).toHaveBeenLastCalledWith("Fresh");
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("disables saving for blank names and shows inline errors", () => {
    render(
      <RenameTagDialogView
        open={true}
        name="   "
        loading={false}
        error="Tag already exists"
        onOpenChange={vi.fn()}
        onNameChange={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    expect(screen.getByText("Tag already exists")).toBeInTheDocument();
  });
});
