import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TagChip } from "@/design-system";

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
    expect(removeButton).toHaveClass(
      "text-foreground-soft",
      "opacity-55",
      "hover:bg-surface-1/72",
      "hover:text-foreground",
    );
    expect(removeButton).not.toHaveClass("text-muted-foreground/60");
    expect(removeButton).not.toHaveClass("opacity-0");

    await user.click(screen.getByRole("button", { name: "Remove personal" }));

    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it("documents the compact inline pointer target for removable chips", () => {
    const { container } = render(
      <div style={{ fontSize: "200%" }}>
        <TagChip
          label="very long personal research tag"
          color="#ff6b6b"
          onRemove={vi.fn()}
          removeLabel="Remove very long personal research tag"
        />
      </div>,
    );

    const chip = container.querySelector(".group\\/tag-chip");
    const label = screen.getByText("very long personal research tag");
    const removeButton = screen.getByRole("button", { name: "Remove very long personal research tag" });

    expect(chip).not.toBeNull();
    expect(chip).toHaveClass("inline-flex", "min-h-6", "px-2.5", "pr-1.5");
    expect(label).toHaveClass("truncate");
    expect(removeButton).toHaveClass(
      "size-4",
      "rounded-full",
      "focus-visible:ring-2",
      "group-focus-within/tag-chip:opacity-100",
    );
  });
});
