import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TagSectionContextMenu } from "@/components/reader/tag-section-context-menu";
import { ContextMenu } from "@/design-system/context-menu";
import { useUiStore } from "@/stores/ui-store";

const tagHooks = vi.hoisted(() => ({
  createTagMutateAsync: vi.fn<(input: { name: string }) => Promise<unknown>>(),
}));

vi.mock("@/hooks/use-tags", () => ({
  useCreateTag: () => ({
    isPending: false,
    mutateAsync: tagHooks.createTagMutateAsync,
  }),
}));

async function submitFailingCreate(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("menuitem", { name: "Add tag" }));
  const dialog = screen.getByRole("dialog");
  const nameInput = within(dialog).getByRole("textbox");
  await user.type(nameInput, "Review");
  await user.click(within(dialog).getByRole("button", { name: /^(Create tag|create_tag)$/ }));
  return { dialog, nameInput };
}

describe("TagSectionContextMenu", () => {
  beforeEach(() => {
    tagHooks.createTagMutateAsync.mockReset();
    tagHooks.createTagMutateAsync.mockRejectedValue(new Error("name already used"));
    useUiStore.setState(useUiStore.getInitialState());
  });

  it("keeps a tag creation failure visible in the create dialog, not only in the toast", async () => {
    const user = userEvent.setup();

    render(
      <ContextMenu.Root open>
        <TagSectionContextMenu onManageTags={vi.fn()} />
      </ContextMenu.Root>,
    );
    const { dialog } = await submitFailingCreate(user);

    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Failed to create tag: name already used");
    expect(useUiStore.getState().toastMessage).toEqual({
      message: "Failed to create tag: name already used",
      severity: "error",
    });
  });

  it("announces a created tag as a plain toast without a severity", async () => {
    const user = userEvent.setup();
    tagHooks.createTagMutateAsync.mockResolvedValue(undefined);

    render(
      <ContextMenu.Root open>
        <TagSectionContextMenu onManageTags={vi.fn()} />
      </ContextMenu.Root>,
    );
    await submitFailingCreate(user);

    await waitFor(() => {
      expect(useUiStore.getState().toastMessage).toEqual({ message: "Tag created" });
    });
  });

  it("clears the creation failure when the user edits the tag name", async () => {
    const user = userEvent.setup();

    render(
      <ContextMenu.Root open>
        <TagSectionContextMenu onManageTags={vi.fn()} />
      </ContextMenu.Root>,
    );
    const { dialog, nameInput } = await submitFailingCreate(user);
    expect(await within(dialog).findByRole("alert")).toBeInTheDocument();

    await user.type(nameInput, "s");

    expect(within(dialog).queryByRole("alert")).not.toBeInTheDocument();
  });
});
