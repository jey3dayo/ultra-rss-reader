import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SidebarHeaderView } from "@/components/reader/sidebar-header-view";

describe("SidebarHeaderView", () => {
  it("renders sync and add feed actions with labels", async () => {
    const user = userEvent.setup();
    const onSync = vi.fn();
    const onAddFeed = vi.fn();

    render(
      <SidebarHeaderView
        isSyncing={false}
        onSync={onSync}
        onAddFeed={onAddFeed}
        syncButtonLabel="Sync feeds"
        addFeedButtonLabel="Add feed"
      />,
    );

    await user.click(screen.getByLabelText("Sync feeds"));
    await user.click(screen.getByLabelText("Add feed"));

    expect(onSync).toHaveBeenCalledTimes(1);
    expect(onAddFeed).toHaveBeenCalledTimes(1);
  });
});
