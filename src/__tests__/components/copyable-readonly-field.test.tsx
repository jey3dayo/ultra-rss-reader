import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CopyableReadonlyField } from "@/components/shared/copyable-readonly-field";

describe("CopyableReadonlyField", () => {
  it("renders a readonly field with a copy action and preserves external focus on mouse click", async () => {
    const user = userEvent.setup();
    const onCopy = vi.fn();

    render(
      <div>
        <input aria-label="Title" />
        <CopyableReadonlyField
          label="Website URL"
          name="website-url"
          value="https://example.com"
          copyLabel="Copy Website URL"
          onCopy={onCopy}
        />
      </div>,
    );

    const titleInput = screen.getByRole("textbox", { name: "Title" });
    titleInput.focus();

    expect(screen.getByLabelText("Website URL")).toHaveValue("https://example.com");
    expect(screen.getByRole("button", { name: "Copy Website URL" })).toHaveClass(
      "active:not-aria-[haspopup]:-translate-y-1/2",
    );

    await user.click(screen.getByRole("button", { name: "Copy Website URL" }));

    expect(onCopy).toHaveBeenCalledTimes(1);
    expect(titleInput).toHaveFocus();
  });
});
