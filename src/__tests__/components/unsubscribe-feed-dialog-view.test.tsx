import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { UnsubscribeFeedDialogView } from "@/components/reader/unsubscribe-feed-dialog-view";

describe("UnsubscribeFeedDialogView", () => {
  it("renders confirmation copy and delegates actions", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const onConfirm = vi.fn();

    render(
      <UnsubscribeFeedDialogView
        open={true}
        title="Unsubscribe"
        description={
          <>
            Are you sure you want to unsubscribe from <strong>Tech Blog</strong>?
          </>
        }
        cancelLabel="Cancel"
        confirmLabel="Unsubscribe"
        onOpenChange={onOpenChange}
        onConfirm={onConfirm}
      />,
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Unsubscribe" })).toBeInTheDocument();
    expect(screen.getByText(/Tech Blog/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Unsubscribe" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
