import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ShortcutsSettingsView } from "@/components/settings/shortcuts-settings-view";

function expectNoButtonMinWidth(button: HTMLElement) {
  expect(
    [...button.classList].filter((className) => className.includes("min-w")),
  ).toEqual([]);
}

describe("ShortcutsSettingsView", () => {
  it("renders shortcut categories, conflicts, and static bindings", async () => {
    const user = userEvent.setup();
    const onStartRecording = vi.fn();

    render(
      <ShortcutsSettingsView
        title="Shortcuts"
        conflictMessage="Shortcut j is already used by Next article"
        pressAKeyLabel="Press a key"
        resetLabel="Reset to defaults"
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
              },
            ],
          },
        ]}
      />,
    );

    expect(
      screen.getByRole("heading", { level: 2, name: "Shortcuts" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Shortcut j is already used by Next article"),
    ).toHaveClass(
      "border-state-danger-border",
      "bg-state-danger-surface",
      "text-state-danger-foreground",
    );
    expect(screen.getByText("Already used")).toHaveClass(
      "text-state-danger-foreground",
    );
    expect(screen.getByText("⌘ ,")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "J" })).toHaveClass(
      "border-state-danger-border",
      "bg-state-danger-surface",
      "text-state-danger-foreground",
    );
    expect(
      screen.getByRole("button", { name: "Reset to defaults: Next article" }),
    ).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "Reset to defaults" }),
    ).toHaveClass("w-full");
    expect(screen.getByRole("button", { name: "J" })).toHaveClass("w-full");
    expect(screen.getByText("⌘ ,")).toHaveClass(
      "bg-surface-1",
      "text-foreground-soft",
    );

    await user.click(screen.getByRole("button", { name: "J" }));

    expect(onStartRecording).toHaveBeenCalledTimes(1);
    const resetButton = screen.getByRole("button", {
      name: "Reset to defaults",
    });
    expect(resetButton).toBeDisabled();
    expectNoButtonMinWidth(resetButton);
  });

  it("keeps row reset disabled only for default bindings and activates focused row reset from the keyboard", async () => {
    const user = userEvent.setup();
    const onResetDefault = vi.fn();
    const onResetCustom = vi.fn();

    render(
      <ShortcutsSettingsView
        title="Shortcuts"
        conflictMessage={null}
        pressAKeyLabel="Press a key"
        resetLabel="Reset to defaults"
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
                onReset: onResetDefault,
              },
              {
                id: "prev_article",
                label: "Previous article",
                displayKey: "P",
                isRecording: false,
                resetDisabled: false,
                onReset: onResetCustom,
              },
            ],
          },
        ]}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Reset to defaults: Next article" }),
    ).toBeDisabled();
    const rowReset = screen.getByRole("button", {
      name: "Reset to defaults: Previous article",
    });
    expect(rowReset).toBeEnabled();

    rowReset.focus();
    await user.keyboard("{Enter}");

    expect(onResetDefault).not.toHaveBeenCalled();
    expect(onResetCustom).toHaveBeenCalledTimes(1);
  });

  it("focuses the active badge and captures the next window key press while recording", async () => {
    const user = userEvent.setup();
    const onStartRecording = vi.fn();
    const onRecordKeyDown = vi.fn();
    const onResetAll = vi.fn();

    const { rerender } = render(
      <ShortcutsSettingsView
        title="Shortcuts"
        conflictMessage={null}
        pressAKeyLabel="Press a key"
        resetLabel="Reset to defaults"
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
        resetLabel="Reset to defaults"
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
                onReset: vi.fn(),
                onStartRecording,
                onKeyDown: onRecordKeyDown,
              },
            ],
          },
        ]}
      />,
    );

    const recordingButton = screen.getByRole("button", { name: "Press a key" });
    expect(recordingButton).toHaveClass("w-full");
    expect(recordingButton).toHaveClass("bg-ring/14");

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
    await user.click(screen.getByRole("button", { name: "Reset to defaults" }));

    expect(onRecordKeyDown).toHaveBeenCalledTimes(2);
    expect(onResetAll).toHaveBeenCalledTimes(1);
  });
});
