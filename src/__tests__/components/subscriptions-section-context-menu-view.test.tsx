import { ContextMenu } from "@base-ui/react/context-menu";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SubscriptionsSectionContextMenuView } from "@/components/reader/subscriptions-section-context-menu-view";

describe("SubscriptionsSectionContextMenuView", () => {
  it("renders subscription section actions and delegates clicks", async () => {
    const user = userEvent.setup();
    const onExpandAllFolders = vi.fn();
    const onCollapseAllFolders = vi.fn();

    render(
      <ContextMenu.Root open>
        <SubscriptionsSectionContextMenuView
          expandAllFoldersLabel="Expand all folders"
          collapseAllFoldersLabel="Collapse all folders"
          onExpandAllFolders={onExpandAllFolders}
          onCollapseAllFolders={onCollapseAllFolders}
        />
      </ContextMenu.Root>,
    );

    await user.click(screen.getByRole("menuitem", { name: "Expand all folders" }));
    await user.click(screen.getByRole("menuitem", { name: "Collapse all folders" }));

    expect(screen.getByRole("menuitem", { name: "Expand all folders" })).toHaveAttribute(
      "data-action-id",
      "subscriptions-expand-all-folders",
    );
    expect(screen.getByRole("menuitem", { name: "Collapse all folders" })).toHaveAttribute(
      "data-action-id",
      "subscriptions-collapse-all-folders",
    );
    expect(onExpandAllFolders).toHaveBeenCalledTimes(1);
    expect(onCollapseAllFolders).toHaveBeenCalledTimes(1);
  });

  it("hides expand and collapse actions when there are no folders", () => {
    const onExpandAllFolders = vi.fn();
    const onCollapseAllFolders = vi.fn();

    render(
      <ContextMenu.Root open>
        <SubscriptionsSectionContextMenuView
          expandAllFoldersLabel="Expand all folders"
          collapseAllFoldersLabel="Collapse all folders"
          hasFolders={false}
          onExpandAllFolders={onExpandAllFolders}
          onCollapseAllFolders={onCollapseAllFolders}
        />
      </ContextMenu.Root>,
    );

    expect(screen.queryByRole("menuitem", { name: "Expand all folders" })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Collapse all folders" })).not.toBeInTheDocument();
    expect(onExpandAllFolders).not.toHaveBeenCalled();
    expect(onCollapseAllFolders).not.toHaveBeenCalled();
  });
});
