import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { ShortcutKeyButton, ShortcutsSettingsView } from "@/components/settings/shortcuts-settings-view";

describe("ShortcutsSettingsView", () => {
  it("passes explicit ref props from ShortcutKeyButton to the underlying button", () => {
    const buttonRef = createRef<HTMLButtonElement>();

    render(<ShortcutKeyButton ref={buttonRef}>J</ShortcutKeyButton>);

    expect(buttonRef.current).toBe(screen.getByRole("button", { name: "J" }));
  });

  it("renders shortcut categories, conflicts, and static bindings", async () => {
    const user = userEvent.setup();
    const onStartRecording = vi.fn();

    render(
      <ShortcutsSettingsView
        title="Shortcuts"
        conflictMessage="Shortcut j is already used by Next article"
        pressAKeyLabel="Press a key"
        resetAllLabel="Reset all to defaults"
        resetDisabled={true}
        onResetAll={() => {}}
        categories={[
          {
            id: "navigation",
            heading: "Navigation",
            items: [
              {
                id: "next_article",
                label: "Next article",
                displayKey: "J",
                isRecording: false,
                resetDisabled: false,
                resetAriaLabel: "Reset Next article shortcut",
                onReset: vi.fn(),
                conflictLabel: "Already used",
                onStartRecording,
                onKeyDown: () => {},
              },
            ],
          },
          {
            id: "global",
            heading: "Global",
            items: [
              {
                id: "open_settings",
                label: "Open settings",
                displayKey: "⌘ ,",
                isLocked: true,
                isRecording: false,
                resetAriaLabel: "Reset Open settings shortcut",
              },
            ],
          },
        ]}
      />,
    );

    expect(screen.getByRole("heading", { level: 2, name: "Shortcuts" })).toBeInTheDocument();
    expect(screen.getByText("Shortcut j is already used by Next article")).toHaveClass(
      "border-state-danger-border",
      "bg-state-danger-surface",
      "text-state-danger-foreground",
    );
    expect(screen.getByText("Already used")).toHaveClass("text-state-danger-foreground");
    expect(screen.getByText("⌘ ,")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reset Open settings shortcut" })).toBeNull();
    expect(screen.getByRole("button", { name: "J" })).toHaveClass(
      "min-h-8",
      "border-state-danger-border",
      "bg-state-danger-surface",
      "text-state-danger-foreground",
    );
    expect(screen.getByRole("button", { name: "Reset Next article shortcut" })).toHaveClass("size-8");
    expect(screen.getByRole("button", { name: "Reset all to defaults" })).toHaveClass("h-9", "min-h-9", "px-3");
    expect(screen.getByRole("button", { name: "Reset all to defaults" })).not.toHaveClass("w-full");
    expect(screen.queryByRole("button", { name: "Reset to defaults" })).toBeNull();
    expect(screen.getByRole("button", { name: "J" })).not.toHaveClass("w-full");
    expect(screen.getByText("Already used")).toHaveClass("text-xs", "break-words");
    expect(screen.getByText("⌘ ,")).toHaveClass("min-h-8", "text-foreground-soft");

    await user.click(screen.getByRole("button", { name: "J" }));

    expect(onStartRecording).toHaveBeenCalledTimes(1);
    const resetButton = screen.getByRole("button", {
      name: "Reset all to defaults",
    });
    expect(resetButton).toBeDisabled();
    expect(resetButton).toHaveClass("h-9", "min-h-9", "px-3");
    expect(resetButton).not.toHaveClass("min-h-11", "min-w-11");
  });

  it("only shows row reset for custom bindings and activates focused row reset from the keyboard", async () => {
    const user = userEvent.setup();
    const onResetDefault = vi.fn();
    const onResetCustom = vi.fn();

    render(
      <ShortcutsSettingsView
        title="Shortcuts"
        conflictMessage={null}
        pressAKeyLabel="Press a key"
        resetAllLabel="Reset all to defaults"
        resetDisabled={false}
        onResetAll={vi.fn()}
        categories={[
          {
            id: "navigation",
            heading: "Navigation",
            items: [
              {
                id: "next_article",
                label: "Next article",
                displayKey: "J",
                isRecording: false,
                resetDisabled: true,
                resetAriaLabel: "Reset Next article shortcut",
                onReset: onResetDefault,
              },
              {
                id: "prev_article",
                label: "Previous article",
                displayKey: "P",
                isRecording: false,
                resetDisabled: false,
                resetAriaLabel: "Reset Previous article shortcut",
                onReset: onResetCustom,
              },
            ],
          },
        ]}
      />,
    );

    expect(screen.queryByRole("button", { name: "Reset Next article shortcut" })).toBeNull();
    const rowReset = screen.getByRole("button", {
      name: "Reset Previous article shortcut",
    });
    expect(rowReset).toBeEnabled();

    rowReset.focus();
    await user.keyboard("{Enter}");

    expect(onResetDefault).not.toHaveBeenCalled();
    expect(onResetCustom).toHaveBeenCalledTimes(1);
  });

  it("prefers explicit row reset aria labels", () => {
    render(
      <ShortcutsSettingsView
        title="Shortcuts"
        conflictMessage={null}
        pressAKeyLabel="Press a key"
        resetAllLabel="Reset all to defaults"
        resetDisabled={false}
        onResetAll={vi.fn()}
        categories={[
          {
            id: "navigation",
            heading: "Navigation",
            items: [
              {
                id: "next_article",
                label: "Next article",
                displayKey: "J",
                isRecording: false,
                resetDisabled: false,
                resetAriaLabel: "Reset Next article shortcut",
                onReset: vi.fn(),
              },
            ],
          },
        ]}
      />,
    );

    expect(screen.getByRole("button", { name: "Reset Next article shortcut" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reset to defaults: Next article" })).toBeNull();
  });

  it("disables resets while recording without interfering with key capture", async () => {
    const user = userEvent.setup();
    const onStartRecording = vi.fn();
    const onRecordKeyDown = vi.fn();
    const onResetAll = vi.fn();
    const onResetRow = vi.fn();

    const { rerender } = render(
      <ShortcutsSettingsView
        title="Shortcuts"
        conflictMessage={null}
        pressAKeyLabel="Press a key"
        resetAllLabel="Reset all to defaults"
        resetDisabled={false}
        onResetAll={onResetAll}
        categories={[
          {
            id: "navigation",
            heading: "Navigation",
            items: [
              {
                id: "next_article",
                label: "Next article",
                displayKey: "J",
                isRecording: false,
                resetDisabled: false,
                resetAriaLabel: "Reset Next article shortcut",
                onReset: vi.fn(),
                onStartRecording,
                onKeyDown: onRecordKeyDown,
              },
            ],
          },
        ]}
      />,
    );

    await user.click(screen.getByRole("button", { name: "J" }));

    expect(onStartRecording).toHaveBeenCalledTimes(1);

    rerender(
      <ShortcutsSettingsView
        title="Shortcuts"
        conflictMessage={null}
        pressAKeyLabel="Press a key"
        resetAllLabel="Reset all to defaults"
        resetDisabled={false}
        onResetAll={onResetAll}
        categories={[
          {
            id: "navigation",
            heading: "Navigation",
            items: [
              {
                id: "next_article",
                label: "Next article",
                displayKey: "J",
                isRecording: true,
                resetDisabled: false,
                resetAriaLabel: "Reset Next article shortcut",
                onReset: onResetRow,
                onStartRecording,
                onKeyDown: onRecordKeyDown,
              },
            ],
          },
        ]}
      />,
    );

    const recordingButton = screen.getByRole("button", { name: "Press a key" });
    expect(recordingButton).not.toHaveClass("w-full");
    expect(recordingButton).toHaveClass("min-h-8");
    expect(recordingButton).toHaveClass("bg-ring/14");
    expect(screen.getByRole("button", { name: "Reset all to defaults" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Reset Next article shortcut" })).toBeDisabled();

    await waitFor(() => {
      expect(recordingButton).toHaveFocus();
    });

    window.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "K",
        metaKey: true,
      }),
    );
    fireEvent.keyDown(recordingButton, {
      key: "K",
      metaKey: true,
    });
    await user.click(screen.getByRole("button", { name: "Reset all to defaults" }));
    await user.click(screen.getByRole("button", { name: "Reset Next article shortcut" }));

    expect(onRecordKeyDown).toHaveBeenCalledTimes(2);
    expect(onResetAll).not.toHaveBeenCalled();
    expect(onResetRow).not.toHaveBeenCalled();
  });
});
