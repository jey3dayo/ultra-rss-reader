import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DeleteTagDialogView } from "@/components/reader/delete-tag-dialog-view";

describe("DeleteTagDialogView", () => {
  it("renders the confirmation copy and delegates actions", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const onConfirm = vi.fn();

    render(
      <DeleteTagDialogView
        open={true}
        tagName="Work"
        loading={false}
        onOpenChange={onOpenChange}
        onConfirm={onConfirm}
      />,
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Delete Tag")).toBeInTheDocument();
    expect(screen.getByText(/Work/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Delete" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("keeps the actions enabled while loading", () => {
    render(
      <DeleteTagDialogView open={true} tagName="Work" loading={true} onOpenChange={vi.fn()} onConfirm={vi.fn()} />,
    );

    expect(screen.getByRole("button", { name: "Delete" })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).not.toBeDisabled();
  });
});
