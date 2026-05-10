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
    expect(screen.getByText(/Work/).closest("p")).toHaveClass("text-foreground-soft");
    expect(screen.getByRole("button", { name: 'Delete "Work". This cannot be undone.' })).toHaveClass("min-h-11");
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveClass("min-h-11");

    await user.click(screen.getByRole("button", { name: 'Delete "Work". This cannot be undone.' }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("keeps confirm and cancel state transitions separate", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const onConfirm = vi.fn();

    const { rerender } = render(
      <DeleteTagDialogView open={true} tagName="Work" onOpenChange={onOpenChange} onConfirm={onConfirm} />,
    );

    await user.click(screen.getByRole("button", { name: 'Delete "Work". This cannot be undone.' }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onOpenChange).not.toHaveBeenCalled();

    onConfirm.mockClear();
    rerender(<DeleteTagDialogView open={true} tagName="Work" onOpenChange={onOpenChange} onConfirm={onConfirm} />);

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onConfirm).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
