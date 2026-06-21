import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CopyableTextField } from "@/design-system";

describe("CopyableTextField", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("selects readonly text on focus and forwards the focus handler", async () => {
    const user = userEvent.setup();
    const onFocus = vi.fn();
    const selectSpy = vi.spyOn(HTMLInputElement.prototype, "select");

    render(
      <CopyableTextField label="Server URL" name="server-url" value="https://example.com" readOnly onFocus={onFocus} />,
    );

    await user.click(screen.getByRole("textbox", { name: "Server URL" }));

    expect(selectSpy).toHaveBeenCalledTimes(1);
    expect(onFocus).toHaveBeenCalledTimes(1);
  });

  it("does not force-select editable text while still forwarding focus", async () => {
    const user = userEvent.setup();
    const onFocus = vi.fn();
    const selectSpy = vi.spyOn(HTMLInputElement.prototype, "select");

    render(
      <CopyableTextField label="Editable URL" name="editable-url" value="https://example.com" onFocus={onFocus} />,
    );

    await user.click(screen.getByRole("textbox", { name: "Editable URL" }));

    expect(selectSpy).not.toHaveBeenCalled();
    expect(onFocus).toHaveBeenCalledTimes(1);
  });

  it("shows the copy button only when label and handler are both provided", () => {
    const { rerender } = render(
      <CopyableTextField
        label="Server URL"
        name="server-url"
        value="https://example.com"
        copyLabel="Copy server URL"
      />,
    );

    expect(screen.queryByRole("button", { name: "Copy server URL" })).not.toBeInTheDocument();

    rerender(<CopyableTextField label="Server URL" name="server-url" value="https://example.com" onCopy={vi.fn()} />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();

    rerender(
      <CopyableTextField
        label="Server URL"
        name="server-url"
        value="https://example.com"
        copyLabel="Copy server URL"
        onCopy={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Copy server URL" })).toBeInTheDocument();
  });

  it("disables the copy button when the field is disabled, empty, or whitespace-only", () => {
    const { rerender } = render(
      <CopyableTextField
        label="Server URL"
        name="server-url"
        value="https://example.com"
        copyLabel="Copy server URL"
        disabled
        onCopy={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Copy server URL" })).toBeDisabled();

    rerender(
      <CopyableTextField label="Server URL" name="server-url" value="" copyLabel="Copy server URL" onCopy={vi.fn()} />,
    );

    expect(screen.getByRole("button", { name: "Copy server URL" })).toBeDisabled();

    rerender(
      <CopyableTextField
        label="Server URL"
        name="server-url"
        value="   "
        copyLabel="Copy server URL"
        onCopy={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Copy server URL" })).toBeDisabled();

    rerender(
      <CopyableTextField
        label="Server URL"
        name="server-url"
        value={"\n\t"}
        copyLabel="Copy server URL"
        onCopy={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Copy server URL" })).toBeDisabled();

    rerender(
      <CopyableTextField
        label="Server URL"
        name="server-url"
        value="https://example.com"
        copyLabel="Copy server URL"
        onCopy={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Copy server URL" })).toBeEnabled();
  });

  it("passes non-blank copy values unchanged", async () => {
    const user = userEvent.setup();
    const onCopy = vi.fn<(value: string) => void>();

    render(
      <CopyableTextField
        label="Server URL"
        name="server-url"
        value="  https://example.com  "
        copyLabel="Copy server URL"
        onCopy={onCopy}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Copy server URL" }));

    expect(onCopy).toHaveBeenCalledOnce();
    expect(onCopy).toHaveBeenCalledWith("  https://example.com  ");
  });

  it("preserves readonly input focus and selection when clicking the copy action", async () => {
    const user = userEvent.setup();
    const onCopy = vi.fn();

    render(
      <CopyableTextField
        label="Server URL"
        name="server-url"
        value="https://example.com"
        readOnly
        copyLabel="Copy server URL"
        onCopy={onCopy}
      />,
    );

    const input = screen.getByRole("textbox", { name: "Server URL" });
    const copyButton = screen.getByRole("button", { name: "Copy server URL" });
    await user.click(input);

    expect(input).toHaveFocus();
    expect(input).toHaveSelection("https://example.com");
    expect(fireEvent.pointerDown(copyButton)).toBe(false);

    await user.click(copyButton);

    expect(onCopy).toHaveBeenCalledOnce();
    expect(input).toHaveFocus();
    expect(input).toHaveSelection("https://example.com");
  });

  it("preserves editable input focus and selection range when clicking the copy action", async () => {
    const user = userEvent.setup();
    const onCopy = vi.fn();

    render(
      <CopyableTextField
        label="Server URL"
        name="server-url"
        value="https://example.com"
        copyLabel="Copy server URL"
        onCopy={onCopy}
      />,
    );

    const input = screen.getByRole("textbox", {
      name: "Server URL",
    });
    expect(input).toBeInstanceOf(HTMLInputElement);
    if (!(input instanceof HTMLInputElement)) {
      throw new TypeError("Expected Server URL textbox to be an input element");
    }
    input.focus();
    input.setSelectionRange(8, 15);

    await user.click(screen.getByRole("button", { name: "Copy server URL" }));

    expect(onCopy).toHaveBeenCalledOnce();
    expect(input).toHaveFocus();
    expect(input.selectionStart).toBe(8);
    expect(input.selectionEnd).toBe(15);
  });
});
