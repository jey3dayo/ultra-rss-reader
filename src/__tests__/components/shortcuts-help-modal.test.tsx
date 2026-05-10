import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createWrapper } from "@tests/helpers/create-wrapper";
import type { ReactElement } from "react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ShortcutsHelpModal } from "@/components/reader/shortcuts-help-modal";
import { usePlatformStore } from "@/stores/platform-store";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";

describe("ShortcutsHelpModal", () => {
  function renderShortcutsHelpModal(ui: ReactElement) {
    const QueryWrapper = createWrapper();

    return render(ui, {
      wrapper: ({ children }) => <QueryWrapper>{children}</QueryWrapper>,
    });
  }

  beforeEach(() => {
    vi.stubGlobal(
      "ResizeObserver",
      class ResizeObserver {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    Element.prototype.scrollIntoView = vi.fn();
    usePlatformStore.setState({
      platform: {
        kind: "windows",
        capabilities: {
          supports_reading_list: false,
          supports_background_browser_open: false,
          supports_runtime_window_icon_replacement: false,
          supports_native_browser_navigation: false,
          uses_dev_file_credentials: false,
        },
      },
      loaded: true,
      loadError: false,
      inFlightLoad: null,
    });
    usePreferencesStore.setState({
      prefs: {
        shortcut_open_settings: "⌘+.",
      },
      loaded: true,
    });
  });

  it("filters shortcuts and shows platform-aware labels", async () => {
    const user = userEvent.setup();

    renderShortcutsHelpModal(<ShortcutsHelpModal open={true} onOpenChange={() => {}} />);

    expect(await screen.findByRole("dialog", { name: "Keyboard shortcuts" })).toBeInTheDocument();
    const input = screen.getByPlaceholderText("Search shortcuts…");
    await user.type(input, "settings");

    const option = await screen.findByRole("option", {
      name: /open settings/i,
    });
    expect(option).toHaveTextContent("Ctrl .");
    expect(screen.getByText("?").closest("kbd")).toHaveClass("text-foreground-soft", "bg-surface-1/72");
    expect(screen.getByText("?").closest("p")).toHaveClass("flex-wrap");
    expect(option).toHaveClass("flex-col");
    expect(option.querySelector("[data-slot='command-shortcut']")).toHaveClass("ml-0");
    expect(screen.getByTestId("shortcuts-help-results")).toHaveClass("motion-content-swap");
    expect(screen.getByTestId("shortcuts-help-results")).toHaveAttribute("data-motion-phase", "entering");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    await user.clear(input);
    await user.type(input, "missing-shortcut");

    const emptyStatus = await screen.findByRole("status");
    expect(emptyStatus).toHaveAttribute("aria-live", "polite");
    expect(emptyStatus).toHaveTextContent("No shortcuts found");

    await user.clear(input);
    await user.type(input, "settings");

    await waitFor(() => {
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });
  });

  it("snapshots generated help content from the actual shortcut bindings", async () => {
    renderShortcutsHelpModal(<ShortcutsHelpModal open={true} onOpenChange={() => {}} />);

    await screen.findByRole("dialog", { name: "Keyboard shortcuts" });

    expect(
      screen.getAllByRole("option").map((option) => ({
        label: option.querySelector("span")?.textContent,
        binding: option.querySelector("[data-slot='command-shortcut']")?.textContent,
      })),
    ).toMatchInlineSnapshot(`
      [
        {
          "binding": "j",
          "label": "Next article",
        },
        {
          "binding": "k",
          "label": "Previous article",
        },
        {
          "binding": "l",
          "label": "Next feed",
        },
        {
          "binding": "h",
          "label": "Previous feed",
        },
        {
          "binding": "u",
          "label": "Focus sidebar",
        },
        {
          "binding": "Ctrl \\",
          "label": "Toggle sidebar",
        },
        {
          "binding": "r",
          "label": "Reload Web Preview",
        },
        {
          "binding": "m",
          "label": "Toggle read / unread",
        },
        {
          "binding": "s",
          "label": "Toggle star",
        },
        {
          "binding": "v",
          "label": "Open Web Preview",
        },
        {
          "binding": "b",
          "label": "Open in external browser",
        },
        {
          "binding": "a",
          "label": "Mark all as read",
        },
        {
          "binding": "Ctrl 1",
          "label": "Show unread articles",
        },
        {
          "binding": "Ctrl 2",
          "label": "Show all articles",
        },
        {
          "binding": "Ctrl 3",
          "label": "Show starred articles",
        },
        {
          "binding": "f",
          "label": "Cycle filter (All / Unread / Starred)",
        },
        {
          "binding": "/",
          "label": "Search",
        },
        {
          "binding": "Ctrl k",
          "label": "Open command palette",
        },
        {
          "binding": "Escape",
          "label": "Close Web Preview / clear selection",
        },
        {
          "binding": "Ctrl .",
          "label": "Open settings",
        },
      ]
    `);
  });

  it("closes when escape is pressed", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();

    renderShortcutsHelpModal(<ShortcutsHelpModal open={true} onOpenChange={onOpenChange} />);

    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalled();
      expect(onOpenChange.mock.calls[0]?.[0]).toBe(false);
    });
  });

  it("keeps search text during unrelated parent updates while open", async () => {
    const user = userEvent.setup();

    function RerenderingShortcutsHelpModal({ rerenderCount }: { rerenderCount: number }) {
      return <ShortcutsHelpModal open={rerenderCount > -1} onOpenChange={() => {}} />;
    }

    const { rerender } = renderShortcutsHelpModal(<RerenderingShortcutsHelpModal rerenderCount={0} />);

    const input = await screen.findByPlaceholderText("Search shortcuts…");
    await user.type(input, "settings");
    expect(input).toHaveValue("settings");

    rerender(<RerenderingShortcutsHelpModal rerenderCount={1} />);

    expect(await screen.findByPlaceholderText("Search shortcuts…")).toHaveValue("settings");
  });

  it("resets search while preserving open focus and selected shortcut behavior after reopen", async () => {
    const user = userEvent.setup();
    const scrollIntoView = vi.mocked(Element.prototype.scrollIntoView);

    function ControlledShortcutsHelpModal() {
      const [open, setOpen] = useState(true);

      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Open help
          </button>
          <ShortcutsHelpModal open={open} onOpenChange={setOpen} />
        </>
      );
    }

    renderShortcutsHelpModal(<ControlledShortcutsHelpModal />);

    const input = await screen.findByPlaceholderText("Search shortcuts…");
    await waitFor(() => expect(input).toHaveFocus());
    await waitFor(() =>
      expect(screen.getByRole("option", { name: /next article/i })).toHaveAttribute("aria-selected", "true"),
    );
    expect(scrollIntoView).toHaveBeenCalled();

    await user.type(input, "settings");
    expect(await screen.findByRole("option", { name: /open settings/i })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /next article/i })).not.toBeInTheDocument();

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Keyboard shortcuts" })).not.toBeInTheDocument());

    scrollIntoView.mockClear();
    await user.click(screen.getByRole("button", { name: "Open help" }));

    const reopenedInput = await screen.findByPlaceholderText("Search shortcuts…");
    await waitFor(() => expect(reopenedInput).toHaveFocus());
    expect(reopenedInput).toHaveValue("");
    const selectedShortcut = await screen.findByRole("option", {
      name: /next article/i,
    });
    await waitFor(() => expect(selectedShortcut).toHaveAttribute("aria-selected", "true"));
    expect(scrollIntoView).toHaveBeenCalled();
  });

  afterEach(() => {
    useUiStore.setState(useUiStore.getInitialState());
  });
});
