import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ShortcutsSettingsView } from "@/components/settings/shortcuts-settings-view";

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

    expect(screen.getByRole("heading", { level: 2, name: "Shortcuts" })).toBeInTheDocument();
    expect(screen.getByText("Shortcut j is already used by Next article")).toBeInTheDocument();
    expect(screen.getByText("Already used")).toBeInTheDocument();
    expect(screen.getByText("⌘ ,")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "J" }));

    expect(onStartRecording).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Reset to defaults" })).toBeDisabled();
  });

  it("delegates recorded key presses and reset actions", async () => {
    const user = userEvent.setup();
    const onRecordKeyDown = vi.fn();
    const onResetAll = vi.fn();

    render(
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
                onStartRecording: () => {},
                onKeyDown: onRecordKeyDown,
              },
            ],
          },
        ]}
      />,
    );

    fireEvent.keyDown(screen.getByRole("button", { name: "Press a key" }), {
      key: "K",
      metaKey: true,
    });
    await user.click(screen.getByRole("button", { name: "Reset to defaults" }));

    expect(onRecordKeyDown).toHaveBeenCalledTimes(1);
    expect(onResetAll).toHaveBeenCalledTimes(1);
  });
});
