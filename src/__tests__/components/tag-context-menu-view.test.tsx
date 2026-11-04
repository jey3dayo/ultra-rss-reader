import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TagContextMenuContent } from "@/components/reader/tag-context-menu";
import { TagContextMenuView } from "@/components/reader/tag-context-menu-view";
import { ContextMenu } from "@/design-system/context-menu";

const tagHooks = vi.hoisted(() => ({
  renameTagMutate: vi.fn<(input: unknown, options?: { onError?: (error: unknown) => void }) => void>(),
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

  it("does not show a no-color option in the tag context menu edit dialog", async () => {
    const user = userEvent.setup();

    render(
      <ContextMenu.Root open>
        <TagContextMenuContent tag={{ id: "tag-1", name: "Review", color: "#cf7868" }} />
      </ContextMenu.Root>,
    );

    await user.click(screen.getByRole("menuitem", { name: "Edit…" }));
    const dialog = screen.getByRole("dialog");

    expect(within(dialog).queryByRole("radio", { name: /No color|reader\.no_color/ })).not.toBeInTheDocument();
    expect(within(dialog).getByRole("radio", { name: "Color #cf7868" })).toBeChecked();
  });

  it("saves the visible default color when editing a tag without a color from the context menu", async () => {
    const user = userEvent.setup();

    render(
      <ContextMenu.Root open>
        <TagContextMenuContent tag={{ id: "tag-1", name: "Review", color: null }} />
      </ContextMenu.Root>,
    );

    await user.click(screen.getByRole("menuitem", { name: "Edit…" }));
    const dialog = screen.getByRole("dialog");
    const nameInput = within(dialog).getByRole("textbox");
    expect(within(dialog).getByRole("radio", { name: "Color #cf7868" })).toBeChecked();

    await user.clear(nameInput);
    await user.type(nameInput, "Reading");
    await user.click(within(dialog).getByRole("button", { name: /^(Save|common\.save)$/ }));

    expect(tagHooks.renameTagMutate).toHaveBeenCalledWith(
      {
        tagId: "tag-1",
        name: "Reading",
        color: "#cf7868",
      },
      expect.any(Object),
    );
  });

  it("keeps a rename failure visible in the edit dialog, not only in the toast", async () => {
    const user = userEvent.setup();
    tagHooks.renameTagMutate.mockImplementation((_input, options) => {
      options?.onError?.(new Error("database is locked"));
    });

    render(
      <ContextMenu.Root open>
        <TagContextMenuContent tag={{ id: "tag-1", name: "Review", color: "#cf7868" }} />
      </ContextMenu.Root>,
    );

    await user.click(screen.getByRole("menuitem", { name: "Edit…" }));
    const dialog = screen.getByRole("dialog");
    const nameInput = within(dialog).getByRole("textbox");
    await user.clear(nameInput);
    await user.type(nameInput, "Reading");
    await user.click(within(dialog).getByRole("button", { name: /^(Save|common\.save)$/ }));

    expect(within(dialog).getByRole("alert")).toHaveTextContent("Failed to rename tag: database is locked");
  });

  it("clears the rename failure when the user edits the tag name", async () => {
    const user = userEvent.setup();
    tagHooks.renameTagMutate.mockImplementation((_input, options) => {
      options?.onError?.(new Error("database is locked"));
    });

    render(
      <ContextMenu.Root open>
        <TagContextMenuContent tag={{ id: "tag-1", name: "Review", color: "#cf7868" }} />
      </ContextMenu.Root>,
    );

    await user.click(screen.getByRole("menuitem", { name: "Edit…" }));
    const dialog = screen.getByRole("dialog");
    const nameInput = within(dialog).getByRole("textbox");
    await user.clear(nameInput);
    await user.type(nameInput, "Reading");
    await user.click(within(dialog).getByRole("button", { name: /^(Save|common\.save)$/ }));
    expect(within(dialog).getByRole("alert")).toBeInTheDocument();

    await user.type(nameInput, "!");

    expect(within(dialog).queryByRole("alert")).not.toBeInTheDocument();
  });

  it("keeps a delete failure visible in the delete dialog, not only in the toast", async () => {
    const user = userEvent.setup();
    tagHooks.deleteTagMutateAsync.mockRejectedValueOnce(new Error("database is locked"));

    render(
      <ContextMenu.Root open>
        <TagContextMenuContent tag={{ id: "tag-1", name: "Review", color: "#cf7868" }} />
      </ContextMenu.Root>,
    );

    await user.click(screen.getByRole("menuitem", { name: "Delete…" }));
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: 'Delete "Review". This cannot be undone.' }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Failed to delete tag: database is locked");
  });

  it("does not show a stale delete failure after the dialog is closed and reopened", async () => {
    const user = userEvent.setup();
    tagHooks.deleteTagMutateAsync.mockRejectedValueOnce(new Error("database is locked"));

    render(
      <ContextMenu.Root open>
        <TagContextMenuContent tag={{ id: "tag-1", name: "Review", color: "#cf7868" }} />
      </ContextMenu.Root>,
    );

    await user.click(screen.getByRole("menuitem", { name: "Delete…" }));
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: 'Delete "Review". This cannot be undone.' }),
    );
    expect(await screen.findByRole("alert")).toBeInTheDocument();

    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: /^(Cancel|common\.cancel)$/ }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    await user.click(screen.getByRole("menuitem", { name: "Delete…" }));

    expect(within(screen.getByRole("dialog")).queryByRole("alert")).not.toBeInTheDocument();
  });
});
