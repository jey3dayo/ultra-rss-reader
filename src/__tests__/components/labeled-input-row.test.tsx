import { render, screen } from "@testing-library/react";
import { Copy } from "lucide-react";
import { describe, expect, it, vi } from "vitest";
import { LabeledInputRow } from "@/design-system";

describe("LabeledInputRow", () => {
  it("announces field errors alongside an existing description and removes them after correction", () => {
    const props = {
      label: "Server URL",
      value: "freshrss.example.net",
      onChange: vi.fn(),
      ariaDescribedBy: "server-help",
    };
    const { rerender } = render(
      <>
        <p id="server-help">Use the full server address.</p>
        <LabeledInputRow {...props} errorText="HTTPS required" />
      </>,
    );

    const input = screen.getByRole("textbox", { name: "Server URL" });
    expect(input).toHaveAccessibleDescription("Use the full server address. HTTPS required");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("aria-errormessage", screen.getByText("HTTPS required").id);

    rerender(
      <>
        <p id="server-help">Use the full server address.</p>
        <LabeledInputRow {...props} value="https://freshrss.example.net" />
      </>,
    );

    expect(input).toHaveAccessibleDescription("Use the full server address.");
    expect(input).not.toHaveAttribute("aria-invalid");
    expect(input).not.toHaveAttribute("aria-errormessage");
  });

  it("anchors the inside action to the input box, not the error message", () => {
    render(
      <LabeledInputRow
        label="Server URL"
        value="freshrss.example.net"
        onChange={vi.fn()}
        errorText="HTTPS required"
        actionLabel="Copy"
        actionAriaLabel="Copy"
        actionIcon={<Copy />}
        actionPlacement="inside"
        onAction={vi.fn()}
      />,
    );

    const input = screen.getByRole("textbox", { name: "Server URL" });
    const button = screen.getByRole("button", { name: "Copy" });
    const anchor = input.parentElement;
    expect(anchor).toHaveClass("relative");
    expect(anchor).toContainElement(button);
    const error = screen.getByText("HTTPS required");
    expect(anchor).not.toContainElement(error);
    expect(error).not.toHaveClass("font-serif");
  });
});
