import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SidebarHeaderView } from "@/components/reader/sidebar-header-view";
import { usePlatformStore } from "@/stores/platform-store";
import { useUiStore } from "@/stores/ui-store";

describe("SidebarHeaderView", () => {
  beforeEach(() => {
    useUiStore.setState({ layoutMode: "wide" });
    usePlatformStore.setState(usePlatformStore.getInitialState());
    delete window.__TAURI_INTERNALS__;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders sync and add feed actions with labels", async () => {
    const user = userEvent.setup();
    const onSync = vi.fn();
    const onAddFeed = vi.fn();

    const { container } = render(
      <SidebarHeaderView
        isSyncing={false}
        onSync={onSync}
        onAddFeed={onAddFeed}
        syncButtonLabel="Sync feeds"
        syncButtonText="Sync"
        addFeedButtonLabel="Add feed"
        addFeedButtonText="Add"
      />,
    );

    expect(container.firstElementChild).toHaveClass("border-b");
    expect(container.firstElementChild).not.toHaveAttribute("data-tauri-drag-region");
    expect(container.querySelector("[data-tauri-drag-region]")).not.toBeNull();
    expect(screen.getByLabelText("Sync feeds")).toHaveClass(
      "text-foreground-soft",
      "hover:bg-[var(--sidebar-hover-surface)]",
      "md:size-8",
    );
    expect(screen.getByLabelText("Add feed")).toHaveClass(
      "text-foreground-soft",
      "hover:bg-[var(--sidebar-hover-surface)]",
      "md:size-8",
    );

    await user.click(screen.getByLabelText("Sync feeds"));
    await user.click(screen.getByLabelText("Add feed"));

    expect(onSync).toHaveBeenCalledTimes(1);
    expect(onAddFeed).toHaveBeenCalledTimes(1);
  });

  it("uses icon-dominant actions in mobile layout", () => {
    useUiStore.setState({ layoutMode: "mobile" });

    render(
      <SidebarHeaderView
        isSyncing={false}
        onSync={vi.fn()}
        onAddFeed={vi.fn()}
        syncButtonLabel="Sync feeds"
        syncButtonText="Sync"
        addFeedButtonLabel="Add feed"
        addFeedButtonText="Add"
      />,
    );

    expect(screen.getByRole("button", { name: "Sync feeds" })).not.toHaveTextContent("Sync");
    expect(screen.getByRole("button", { name: "Sync feeds" })).toHaveClass("size-11", "rounded-md");
    expect(screen.getByRole("button", { name: "Add feed" })).not.toHaveTextContent("Add");
    expect(screen.getByRole("button", { name: "Add feed" })).toHaveClass("size-11", "rounded-md");
  });

  it("reserves left space for mac overlay traffic lights only on mac desktop", () => {
    window.__TAURI_INTERNALS__ = {} as typeof window.__TAURI_INTERNALS__;
    usePlatformStore.setState({
      platform: {
        kind: "macos",
        capabilities: {
          supports_reading_list: false,
          supports_background_browser_open: false,
          supports_runtime_window_icon_replacement: true,
          supports_native_browser_navigation: true,
          uses_dev_file_credentials: false,
        },
      },
      loaded: true,
      loadError: false,
      inFlightLoad: null,
    });

    const { container } = render(
      <SidebarHeaderView
        isSyncing={false}
        onSync={vi.fn()}
        onAddFeed={vi.fn()}
        syncButtonLabel="Sync feeds"
        syncButtonText="Sync"
        addFeedButtonLabel="Add feed"
        addFeedButtonText="Add"
      />,
    );

    expect(container.firstElementChild).toHaveClass("pl-20");
  });

  it("keeps sidebar actions flush on windows desktop without mac-only left padding", () => {
    window.__TAURI_INTERNALS__ = {} as typeof window.__TAURI_INTERNALS__;
    usePlatformStore.setState({
      platform: {
        kind: "windows",
        capabilities: {
          supports_reading_list: false,
          supports_background_browser_open: false,
          supports_runtime_window_icon_replacement: true,
          supports_native_browser_navigation: true,
          uses_dev_file_credentials: false,
        },
      },
      loaded: true,
      loadError: false,
      inFlightLoad: null,
    });

    const { container } = render(
      <SidebarHeaderView
        isSyncing={false}
        onSync={vi.fn()}
        onAddFeed={vi.fn()}
        syncButtonLabel="Sync feeds"
        syncButtonText="Sync"
        addFeedButtonLabel="Add feed"
        addFeedButtonText="Add"
      />,
    );

    expect(container.firstElementChild).not.toHaveClass("pl-20");
  });

  it("shows the cooldown countdown in the sync tooltip while keeping the button hoverable", async () => {
    const user = userEvent.setup();

    render(
      <SidebarHeaderView
        isSyncing={false}
        onSync={vi.fn()}
        onAddFeed={vi.fn()}
        syncButtonLabel="Sync feeds"
        syncTooltipLabel="Sync available in 15s"
        syncButtonText="Sync"
        addFeedButtonLabel="Add feed"
        addFeedButtonText="Add"
        isSyncCoolingDown={true}
      />,
    );

    const syncButton = screen.getByRole("button", { name: "Sync feeds" });
    expect(syncButton).not.toBeDisabled();
    expect(syncButton).toHaveAttribute("aria-disabled", "true");

    await user.hover(syncButton);

    expect(await screen.findByText("Sync available in 15s")).toHaveClass("motion-popup-surface");
  });

  it("spins the sync icon for one second after an accepted click", async () => {
    vi.useFakeTimers();

    render(
      <SidebarHeaderView
        isSyncing={false}
        onSync={vi.fn()}
        onAddFeed={vi.fn()}
        syncButtonLabel="Sync feeds"
        syncButtonText="Sync"
        addFeedButtonLabel="Add feed"
        addFeedButtonText="Add"
      />,
    );

    const syncButton = screen.getByRole("button", { name: "Sync feeds" });
    const icon = syncButton.querySelector("svg");

    expect(icon).not.toHaveClass("animate-spin");

    fireEvent.click(syncButton);
    expect(icon).toHaveClass("animate-spin");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(999);
    });
    expect(icon).toHaveClass("animate-spin");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(icon).not.toHaveClass("animate-spin");
  });

  it("spins briefly on cooldown clicks to acknowledge input", async () => {
    vi.useFakeTimers();

    render(
      <SidebarHeaderView
        isSyncing={false}
        onSync={vi.fn()}
        onAddFeed={vi.fn()}
        syncButtonLabel="Sync feeds"
        syncTooltipLabel="Sync available in 15s"
        syncButtonText="Sync"
        addFeedButtonLabel="Add feed"
        addFeedButtonText="Add"
        isSyncCoolingDown={true}
      />,
    );

    const syncButton = screen.getByRole("button", { name: "Sync feeds" });
    const icon = syncButton.querySelector("svg");

    fireEvent.click(syncButton);
    expect(icon).toHaveClass("animate-spin");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(449);
    });
    expect(icon).toHaveClass("animate-spin");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(icon).not.toHaveClass("animate-spin");
  });
});
