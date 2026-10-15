import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createWrapper } from "@tests/helpers/create-wrapper";
import type { ReactElement } from "react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ShortcutsHelpModal } from "@/components/reader/shortcuts-help-modal";
import i18n from "@/lib/i18n";
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

  beforeEach(async () => {
    await i18n.changeLanguage("en");
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
    expect(screen.getByRole("button", { name: "Close dialog" })).toHaveClass("size-11");
    const input = screen.getByRole("searchbox", { name: "Search shortcuts…" });
    await user.type(input, "settings");

    const row = await screen.findByRole("row", { name: /open settings/i });
    expect(row).toHaveTextContent("Ctrl ,");
    expect(screen.queryByRole("row", { name: /next article/i })).not.toBeInTheDocument();
    expect(screen.getByText("?").closest("kbd")).toHaveClass("text-foreground-soft", "bg-surface-1/72");
    expect(screen.getByText("?").closest("p")).toHaveClass("flex-wrap");
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

    expect(screen.getByRole("searchbox", { name: "Search shortcuts…" })).toHaveValue("");

    expect(
      within(screen.getByTestId("shortcuts-help-results"))
        .getAllByRole("row")
        .map((row) => ({
          label: within(row).getByRole("rowheader").textContent,
          binding: row.querySelector("[data-slot='kbd']")?.textContent,
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
          "binding": "Space",
          "label": "Scroll article down",
        },
        {
          "binding": "Shift + Space",
          "label": "Scroll article up",
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
          "binding": "Ctrl ,",
          "label": "Open settings",
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
      ]
    `);
  });

  it("keeps open help labels on one locale while language changes", async () => {
    await i18n.changeLanguage("en");

    renderShortcutsHelpModal(<ShortcutsHelpModal open={true} onOpenChange={() => {}} />);

    expect(await screen.findByRole("dialog", { name: "Keyboard shortcuts" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Search shortcuts…")).toBeInTheDocument();

    await i18n.changeLanguage("ja");

    expect(screen.getByRole("dialog", { name: "Keyboard shortcuts" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Search shortcuts…")).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "キーボードショートカット" })).not.toBeInTheDocument();
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

  it("resets search and refocuses the input after reopen", async () => {
    const user = userEvent.setup();

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

    await user.type(input, "settings");
    expect(await screen.findByRole("row", { name: /open settings/i })).toBeInTheDocument();
    expect(screen.queryByRole("row", { name: /next article/i })).not.toBeInTheDocument();

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Keyboard shortcuts" })).not.toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Open help" }));

    const reopenedInput = await screen.findByPlaceholderText("Search shortcuts…");
    await waitFor(() => expect(reopenedInput).toHaveFocus());
    expect(reopenedInput).toHaveValue("");
    expect(await screen.findByRole("row", { name: /next article/i })).toBeInTheDocument();
  });

  it("matches the search text against label, key, and category in definition order", async () => {
    const user = userEvent.setup();

    renderShortcutsHelpModal(<ShortcutsHelpModal open={true} onOpenChange={() => {}} />);

    const input = await screen.findByRole("searchbox", { name: "Search shortcuts…" });
    await user.type(input, "NAVIGATION");

    const results = screen.getByTestId("shortcuts-help-results");
    const labels = within(results)
      .getAllByRole("rowheader")
      .map((header) => header.textContent);
    expect(labels.slice(0, 3)).toEqual(["Next article", "Previous article", "Scroll article down"]);
    expect(labels).not.toContain("Open settings");

    await user.clear(input);
    await user.type(input, "ctrl k");

    expect(screen.getByRole("row", { name: /open command palette/i })).toBeInTheDocument();
    expect(screen.queryByRole("row", { name: /next article/i })).not.toBeInTheDocument();
  });

  it("renders rows as read-only table content that cannot be selected or activated", async () => {
    renderShortcutsHelpModal(<ShortcutsHelpModal open={true} onOpenChange={() => {}} />);

    await screen.findByRole("dialog", { name: "Keyboard shortcuts" });
    const results = screen.getByTestId("shortcuts-help-results");

    expect(within(results).getAllByRole("row").length).toBeGreaterThan(0);
    expect(within(results).queryAllByRole("option")).toEqual([]);
    expect(within(results).queryAllByRole("button")).toEqual([]);
  });

  it("lets keyboard users focus the overflowing results viewport so it can be scrolled without a mouse", async () => {
    vi.spyOn(Element.prototype, "scrollHeight", "get").mockReturnValue(800);
    vi.spyOn(Element.prototype, "clientHeight", "get").mockReturnValue(400);
    const user = userEvent.setup();

    renderShortcutsHelpModal(<ShortcutsHelpModal open={true} onOpenChange={() => {}} />);

    const input = await screen.findByRole("searchbox", { name: "Search shortcuts…" });
    await waitFor(() => expect(input).toHaveFocus());

    await user.tab();

    const region = screen.getByRole("region", { name: "Keyboard shortcut results" });
    const viewport = region.querySelector('[data-slot="scroll-area-viewport"]');
    expect(viewport).toHaveFocus();
  });

  it("shows the command palette key in the footer hint", async () => {
    renderShortcutsHelpModal(<ShortcutsHelpModal open={true} onOpenChange={() => {}} />);

    const hint = await screen.findByText("Run actions from the command palette");
    expect(hint.querySelector("[data-slot='kbd']")).toHaveTextContent("Ctrl k");
  });

  it("closes the help and opens the shortcuts settings from the footer button", async () => {
    const user = userEvent.setup();
    useUiStore.getState().openShortcutsHelp();

    renderShortcutsHelpModal(
      <ShortcutsHelpModal
        open={true}
        onOpenChange={(nextOpen) => !nextOpen && useUiStore.getState().closeShortcutsHelp()}
      />,
    );

    await user.click(await screen.findByRole("button", { name: "Change key bindings" }));

    expect(useUiStore.getState().shortcutsHelpOpen).toBe(false);
    expect(useUiStore.getState().settingsOpen).toBe(true);
    expect(useUiStore.getState().settingsCategory).toBe("shortcuts");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    useUiStore.setState(useUiStore.getInitialState());
  });
});
