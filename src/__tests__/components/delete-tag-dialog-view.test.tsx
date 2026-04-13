import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DeleteTagDialogView } from "@/components/reader/delete-tag-dialog-view";

describe("DeleteTagDialogView", () => {
  it("renders the confirmation copy and delegates actions", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const onConfirm = vi.fn();

    render(<DeleteTagDialogView open={true} tagName="Work" onOpenChange={onOpenChange} onConfirm={onConfirm} />);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Delete Tag")).toBeInTheDocument();
    expect(screen.getByText(/Work/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete" })).toHaveClass("min-h-11");
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveClass("min-h-11");

    await user.click(screen.getByRole("button", { name: "Delete" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
