import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SidebarHeaderView } from "@/components/reader/sidebar-header-view";
import { useUiStore } from "@/stores/ui-store";

describe("SidebarHeaderView", () => {
  beforeEach(() => {
    useUiStore.setState({ layoutMode: "wide" });
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
    );
    expect(screen.getByLabelText("Add feed")).toHaveClass(
      "text-foreground-soft",
      "hover:bg-[var(--sidebar-hover-surface)]",
    );

    await user.click(screen.getByLabelText("Sync feeds"));
    await user.click(screen.getByLabelText("Add feed"));

    expect(onSync).toHaveBeenCalledTimes(1);
    expect(onAddFeed).toHaveBeenCalledTimes(1);
  });

  it("shows short text labels in mobile layout", () => {
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

    expect(screen.getByRole("button", { name: "Sync feeds" })).toHaveTextContent("Sync");
    expect(screen.getByRole("button", { name: "Sync feeds" }).querySelector("span")).toHaveClass("text-sm");
    expect(screen.getByRole("button", { name: "Add feed" })).toHaveTextContent("Add");
    expect(screen.getByRole("button", { name: "Add feed" }).querySelector("span")).toHaveClass("text-sm");
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
