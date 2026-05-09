import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SidebarHeaderProps } from "@/components/reader/sidebar-header-view";
import { SidebarHeaderView } from "@/components/reader/sidebar-header-view";

const defaultProps = {
  onSync: vi.fn(),
  onAddFeed: vi.fn(),
  syncButtonLabel: "Sync feeds",
  syncButtonText: "Sync",
  addFeedButtonLabel: "Add feed",
  addFeedButtonText: "Add",
  displayState: {
    layout: "desktop",
    titlebar: "standard",
  },
  syncState: {
    status: "idle",
  },
  actionAvailability: {
    addFeed: "available",
  },
} satisfies SidebarHeaderProps;

describe("SidebarHeaderView", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("renders sync and add feed actions with labels", async () => {
    const user = userEvent.setup();
    const onSync = vi.fn();
    const onAddFeed = vi.fn();

    const { container } = render(<SidebarHeaderView {...defaultProps} onSync={onSync} onAddFeed={onAddFeed} />);

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
    render(<SidebarHeaderView {...defaultProps} displayState={{ ...defaultProps.displayState, layout: "mobile" }} />);

    expect(screen.getByRole("button", { name: "Sync feeds" })).not.toHaveTextContent("Sync");
    expect(screen.getByRole("button", { name: "Sync feeds" })).toHaveClass("size-11", "rounded-md");
    expect(screen.getByRole("button", { name: "Add feed" })).not.toHaveTextContent("Add");
    expect(screen.getByRole("button", { name: "Add feed" })).toHaveClass("size-11", "rounded-md");
  });

  it("reserves left space when the controller requests desktop overlay padding", () => {
    const { container } = render(
      <SidebarHeaderView
        {...defaultProps}
        displayState={{
          ...defaultProps.displayState,
          titlebar: "desktop-overlay",
        }}
      />,
    );

    expect(container.firstElementChild).toHaveClass("pl-20");
  });

  it("keeps sidebar actions flush when desktop overlay padding is not requested", () => {
    const { container } = render(
      <SidebarHeaderView
        {...defaultProps}
        displayState={{
          ...defaultProps.displayState,
          titlebar: "standard",
        }}
      />,
    );

    expect(container.firstElementChild).not.toHaveClass("pl-20");
  });

  it("shows the cooldown countdown in the sync tooltip while keeping the button hoverable", async () => {
    const user = userEvent.setup();

    render(
      <SidebarHeaderView
        {...defaultProps}
        syncTooltipLabel="Sync available in 15s"
        syncState={{ status: "cooldown" }}
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

    render(<SidebarHeaderView {...defaultProps} />);

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

  it("does not activate or spin on cooldown clicks", async () => {
    vi.useFakeTimers();
    const onSync = vi.fn();

    render(
      <SidebarHeaderView
        {...defaultProps}
        onSync={onSync}
        syncTooltipLabel="Sync available in 15s"
        syncState={{ status: "cooldown" }}
      />,
    );

    const syncButton = screen.getByRole("button", { name: "Sync feeds" });
    const icon = syncButton.querySelector("svg");

    fireEvent.click(syncButton);
    expect(onSync).toHaveBeenCalledTimes(1);
    expect(icon).not.toHaveClass("animate-spin");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(450);
    });
    expect(icon).not.toHaveClass("animate-spin");
  });

  it("disables add feed through the action availability boundary", async () => {
    const user = userEvent.setup();
    const onAddFeed = vi.fn();

    render(
      <SidebarHeaderView
        {...defaultProps}
        onAddFeed={onAddFeed}
        actionAvailability={{
          addFeed: "disabled",
        }}
      />,
    );

    const addFeedButton = screen.getByRole("button", { name: "Add feed" });

    expect(addFeedButton).toBeDisabled();

    await user.click(addFeedButton);

    expect(onAddFeed).not.toHaveBeenCalled();
  });
});
