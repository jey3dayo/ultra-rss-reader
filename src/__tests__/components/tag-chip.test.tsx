import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TagChip } from "@/components/shared/tag-chip";

describe("TagChip", () => {
  it("renders the label and optional color dot", () => {
    const { container } = render(<TagChip label="personal" color="#ff6b6b" />);

    expect(screen.getByText("personal")).toBeInTheDocument();
    expect(container.querySelector("span[style]")).not.toBeNull();
  });

  it("calls remove when the dismiss control is pressed", async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();

    render(<TagChip label="personal" onRemove={onRemove} removeLabel="Remove personal" />);

    const removeButton = screen.getByRole("button", { name: "Remove personal" });
    expect(removeButton).toHaveClass("hover:bg-surface-1/72", "hover:text-foreground");

    await user.click(screen.getByRole("button", { name: "Remove personal" }));

    expect(onRemove).toHaveBeenCalledTimes(1);
  });
});
