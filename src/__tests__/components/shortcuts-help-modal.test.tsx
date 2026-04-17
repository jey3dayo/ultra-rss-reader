import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ShortcutsHelpModal } from "@/components/reader/shortcuts-help-modal";
import { usePlatformStore } from "@/stores/platform-store";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";
import { createWrapper } from "../../../tests/helpers/create-wrapper";

describe("ShortcutsHelpModal", () => {
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

    render(<ShortcutsHelpModal open={true} onOpenChange={() => {}} />, { wrapper: createWrapper() });

    expect(await screen.findByRole("dialog", { name: "Keyboard shortcuts" })).toBeInTheDocument();
    const input = screen.getByPlaceholderText("Search shortcuts…");
    await user.type(input, "settings");

    const option = await screen.findByRole("option", { name: /Open settings/ });
    expect(option).toHaveTextContent("Ctrl .");
    expect(screen.getByText("?").closest("kbd")).toHaveClass("text-foreground-soft", "bg-surface-1/72");
    expect(screen.getByText("?").closest("p")).toHaveClass("flex-wrap");
    expect(option).toHaveClass("flex-col");
    expect(option.querySelector("[data-slot='command-shortcut']")).toHaveClass("ml-0");
  });

  it("closes when escape is pressed", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();

    render(<ShortcutsHelpModal open={true} onOpenChange={onOpenChange} />, { wrapper: createWrapper() });

    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalled();
      expect(onOpenChange.mock.calls[0]?.[0]).toBe(false);
    });
  });

  afterEach(() => {
    useUiStore.setState(useUiStore.getInitialState());
  });
});
