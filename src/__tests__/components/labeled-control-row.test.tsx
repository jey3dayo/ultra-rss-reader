import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { LabeledControlRow } from "@/design-system";

describe("LabeledControlRow", () => {
  it("uses softened label tone and keeps the row divider contract", () => {
    render(
      <LabeledControlRow label="Open links">
        <button type="button">Control</button>
      </LabeledControlRow>,
    );

    expect(screen.getByText("Open links")).toHaveClass("text-[color:var(--form-row-label)]");
    expect(screen.getByText("Open links")).toHaveClass("select-none");
    expect(screen.getByText("Open links").closest("div")).toHaveClass(
      "motion-contextual-surface",
      "border-b",
      "border-border/60",
    );
  });

  it("exposes a stable description id to row-owned controls", () => {
    render(
      <LabeledControlRow label="Open links" description="Choose how article links open.">
        {({ descriptionId }) => (
          <button type="button" aria-describedby={descriptionId}>
            Control
          </button>
        )}
      </LabeledControlRow>,
    );

    const description = screen.getByText("Choose how article links open.");
    const control = screen.getByRole("button", { name: "Control" });

    expect(description).toHaveAttribute("id");
    expect(control).toHaveAttribute("aria-describedby", description.id);
  });

  it("keeps a label accessory outside the native label and preserves control association", async () => {
    const user = userEvent.setup();
    const inputClick = vi.fn();
    render(
      <LabeledControlRow
        label="Server URL"
        description="The address used to connect to this server."
        htmlFor="server-url"
        labelId="server-url-label"
        labelAccessory={<button type="button">Help</button>}
      >
        <input id="server-url" onClick={inputClick} />
      </LabeledControlRow>,
    );

    const input = screen.getByLabelText("Server URL");
    const help = screen.getByRole("button", { name: "Help" });
    const label = screen.getByText("Server URL").closest("label");
    const titleLine = label?.parentElement;
    const labelContent = titleLine?.parentElement;

    expect(input).toHaveAttribute("id", "server-url");
    expect(label).toHaveAttribute("for", "server-url");
    expect(screen.getByText("Server URL")).toHaveAttribute("id", "server-url-label");
    expect(label).not.toContainElement(help);
    expect(titleLine).toContainElement(help);
    expect(labelContent).toContainElement(screen.getByText("The address used to connect to this server."));

    await user.click(help);
    expect(inputClick).not.toHaveBeenCalled();
  });
});
