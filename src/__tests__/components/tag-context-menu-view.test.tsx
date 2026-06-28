import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TagContextMenuContent } from "@/components/reader/tag-context-menu";
import { TagContextMenuView } from "@/components/reader/tag-context-menu-view";
import { ContextMenu } from "@/design-system";

const tagHooks = vi.hoisted(() => ({
  renameTagMutate: vi.fn(),
  deleteTagMutateAsync: vi.fn<() => Promise<unknown>>(),
}));

vi.mock("@/hooks/use-tags", () => ({
  useRenameTag: () => ({
    isPending: false,
    mutate: tagHooks.renameTagMutate,
  }),
  useDeleteTag: () => ({
    isPending: false,
    mutateAsync: tagHooks.deleteTagMutateAsync,
  }),
}));

describe("TagContextMenuView", () => {
  beforeEach(() => {
    tagHooks.renameTagMutate.mockReset();
    tagHooks.deleteTagMutateAsync.mockReset();
    tagHooks.deleteTagMutateAsync.mockResolvedValue(undefined);
  });

  it("renders menu items and delegates actions", async () => {
    const user = userEvent.setup();
    const onRename = vi.fn();
    const onDelete = vi.fn();

    render(
      <ContextMenu.Root open>
        <TagContextMenuView onRename={onRename} onDelete={onDelete} />
      </ContextMenu.Root>,
    );

    expect(screen.getByRole("menuitem", { name: "Delete…" })).toHaveClass(
      "text-state-danger-foreground",
      "data-highlighted:bg-state-danger-surface",
    );
    expect(screen.getByRole("menuitem", { name: "Edit…" })).toHaveAttribute("data-action-id", "tag-edit");
    expect(screen.getByRole("menuitem", { name: "Delete…" })).toHaveAttribute("data-action-id", "tag-delete");

    await user.click(screen.getByRole("menuitem", { name: "Edit…" }));
    await user.click(screen.getByRole("menuitem", { name: "Delete…" }));

    expect(onRename).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it("saves color changes from the tag context menu edit dialog", async () => {
    const user = userEvent.setup();

    render(
      <ContextMenu.Root open>
        <TagContextMenuContent tag={{ id: "tag-1", name: "Review", color: "#cf7868" }} />
      </ContextMenu.Root>,
    );

    await user.click(screen.getByRole("menuitem", { name: "Edit…" }));
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("radio", { name: "Color #6f8eb8" }));
    await user.click(within(dialog).getByRole("button", { name: /^(Save|common\.save)$/ }));

    expect(tagHooks.renameTagMutate).toHaveBeenCalledWith(
      {
        tagId: "tag-1",
        name: "Review",
        color: "#6f8eb8",
      },
      expect.any(Object),
    );
  });

  it("clears color from the tag context menu edit dialog", async () => {
    const user = userEvent.setup();

    render(
      <ContextMenu.Root open>
        <TagContextMenuContent tag={{ id: "tag-1", name: "Review", color: "#cf7868" }} />
      </ContextMenu.Root>,
    );

    await user.click(screen.getByRole("menuitem", { name: "Edit…" }));
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("radio", { name: /No color|reader\.no_color/ }));
    await user.click(within(dialog).getByRole("button", { name: /^(Save|common\.save)$/ }));

    expect(tagHooks.renameTagMutate).toHaveBeenCalledWith(
      {
        tagId: "tag-1",
        name: "Review",
        color: null,
      },
      expect.any(Object),
    );
  });
});
