import { render, screen } from "@testing-library/react";
import { Copy } from "lucide-react";
import { describe, expect, it, vi } from "vitest";
import { Input, LabeledInputRow } from "@/design-system";

describe("LabeledInputRow", () => {
  it("suppresses autofill for ordinary inputs while preserving explicit caller choices", () => {
    render(
      <>
        <Input aria-label="Ordinary input" />
        <Input aria-label="Password input" type="password" />
        <Input aria-label="Password with autofill disabled" type="password" autoComplete="off" />
        <Input aria-label="Username input" autoComplete="username" />
        <Input aria-label="Autofill disabled input" autoComplete="off" />
        <Input
          aria-label="Custom ignore settings"
          data-1p-ignore="false"
          data-lpignore="false"
          data-form-type="custom"
        />
      </>,
    );

    const ordinaryInput = screen.getByRole("textbox", { name: "Ordinary input" });
    expect(ordinaryInput).toHaveAttribute("autocomplete", "off");
    expect(ordinaryInput).toHaveAttribute("data-1p-ignore", "true");
    expect(ordinaryInput).toHaveAttribute("data-lpignore", "true");
    expect(ordinaryInput).toHaveAttribute("data-form-type", "other");

    const passwordInput = screen.getByLabelText("Password input");
    expect(passwordInput).not.toHaveAttribute("autocomplete");
    expect(passwordInput).not.toHaveAttribute("data-1p-ignore");
    expect(passwordInput).not.toHaveAttribute("data-lpignore");
    expect(passwordInput).not.toHaveAttribute("data-form-type");

    const passwordWithAutofillDisabled = screen.getByLabelText("Password with autofill disabled");
    expect(passwordWithAutofillDisabled).toHaveAttribute("autocomplete", "off");
    expect(passwordWithAutofillDisabled).toHaveAttribute("data-1p-ignore", "true");
    expect(passwordWithAutofillDisabled).toHaveAttribute("data-lpignore", "true");
    expect(passwordWithAutofillDisabled).toHaveAttribute("data-form-type", "other");

    const usernameInput = screen.getByRole("textbox", { name: "Username input" });
    expect(usernameInput).toHaveAttribute("autocomplete", "username");
    expect(usernameInput).not.toHaveAttribute("data-1p-ignore");
    expect(usernameInput).not.toHaveAttribute("data-lpignore");
    expect(usernameInput).not.toHaveAttribute("data-form-type");

    const disabledAutofillInput = screen.getByRole("textbox", { name: "Autofill disabled input" });
    expect(disabledAutofillInput).toHaveAttribute("autocomplete", "off");
    expect(disabledAutofillInput).toHaveAttribute("data-1p-ignore", "true");
    expect(disabledAutofillInput).toHaveAttribute("data-lpignore", "true");
    expect(disabledAutofillInput).toHaveAttribute("data-form-type", "other");

    const customInput = screen.getByRole("textbox", { name: "Custom ignore settings" });
    expect(customInput).toHaveAttribute("autocomplete", "off");
    expect(customInput).toHaveAttribute("data-1p-ignore", "false");
    expect(customInput).toHaveAttribute("data-lpignore", "false");
    expect(customInput).toHaveAttribute("data-form-type", "custom");
  });

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
