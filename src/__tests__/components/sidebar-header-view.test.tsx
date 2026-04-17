import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SidebarHeaderView } from "@/components/reader/sidebar-header-view";
import { useUiStore } from "@/stores/ui-store";

describe("SidebarHeaderView", () => {
  beforeEach(() => {
    useUiStore.setState({ layoutMode: "wide" });
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
    expect(screen.getByLabelText("Sync feeds")).toHaveClass("text-foreground-soft", "hover:bg-sidebar-accent/28");
    expect(screen.getByLabelText("Add feed")).toHaveClass("text-foreground-soft", "hover:bg-sidebar-accent/28");

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
});
