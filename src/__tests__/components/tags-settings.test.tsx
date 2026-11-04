import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createDeferred } from "@tests/helpers/deferred";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TagsSettings } from "@/components/settings/tags-settings";
import { useUiStore } from "@/stores/ui-store";

const tagHooks = vi.hoisted(() => ({
  tagsData: [] as Array<{ id: string; name: string; color: string | null }>,
  tagsIsError: false,
  createTagMutateAsync: vi.fn<(input: { name: string; color?: string }) => Promise<unknown>>(),
  renameTagMutateAsync: vi.fn<(input: { tagId: string; name: string; color?: string | null }) => Promise<unknown>>(),
  deleteTagMutateAsync: vi.fn<(input: { tagId: string }) => Promise<unknown>>(),
  useRegisterSettingsDirtyState: vi.fn(),
}));

vi.mock("@/hooks/use-tags", () => ({
  useTags: () => ({ data: tagHooks.tagsData, isError: tagHooks.tagsIsError }),
  useCreateTag: () => ({
    isPending: false,
    mutateAsync: tagHooks.createTagMutateAsync,
  }),
  useRenameTag: () => ({
    isPending: false,
    mutateAsync: tagHooks.renameTagMutateAsync,
  }),
  useDeleteTag: () => ({
    isPending: false,
    mutateAsync: tagHooks.deleteTagMutateAsync,
  }),
}));

vi.mock("@/components/settings/hooks/use-settings-dirty-state-registry", () => ({
  useRegisterSettingsDirtyState: tagHooks.useRegisterSettingsDirtyState,
}));

describe("TagsSettings", () => {
  beforeEach(() => {
    tagHooks.tagsData = [];
    tagHooks.tagsIsError = false;
    tagHooks.createTagMutateAsync.mockReset();
    tagHooks.renameTagMutateAsync.mockReset();
    tagHooks.deleteTagMutateAsync.mockReset();
    tagHooks.useRegisterSettingsDirtyState.mockReset();
    tagHooks.createTagMutateAsync.mockReturnValue(new Promise(() => {}));
    useUiStore.setState(useUiStore.getInitialState());
  });

  it("does not mark the settings modal dirty when the tag page opens with its default color", () => {
    render(<TagsSettings />);

    expect(tagHooks.useRegisterSettingsDirtyState).toHaveBeenLastCalledWith({
      owner: "tag",
      dirty: false,
      pending: false,
      blockingReason: null,
    });
  });

  it("guards tag creation from repeated clicks before pending state is reflected", async () => {
    const user = userEvent.setup();

    render(<TagsSettings />);

    await user.type(screen.getByRole("textbox"), "Review");
    const nameInput = screen.getByRole("textbox");
    const form = nameInput.closest("form");
    const createButton = screen.getByRole("button", {
      name: /^(Create|tags\.create)$/,
    });

    await waitFor(() => {
      expect(createButton).toBeEnabled();
    });

    if (!form) {
      throw new Error("Expected tag creation input to be inside a form");
    }

    fireEvent.click(createButton);
    fireEvent.submit(form);

    expect(tagHooks.createTagMutateAsync).toHaveBeenCalledTimes(1);
    expect(tagHooks.createTagMutateAsync).toHaveBeenCalledWith({
      name: "Review",
      color: "#cf7868",
    });
  });

  it("guards tag creation from repeated Enter submits before pending state is reflected", async () => {
    const user = userEvent.setup();

    render(<TagsSettings />);

    const nameInput = screen.getByRole("textbox");
    await user.type(nameInput, "Review");
    const form = nameInput.closest("form");

    if (!form) {
      throw new Error("Expected tag creation input to be inside a form");
    }

    await user.type(nameInput, "{Enter}");
    fireEvent.submit(form);

    expect(tagHooks.createTagMutateAsync).toHaveBeenCalledTimes(1);
    expect(tagHooks.createTagMutateAsync).toHaveBeenCalledWith({
      name: "Review",
      color: "#cf7868",
    });
  });

  it("shows tag load failure separately from the true empty state", () => {
    tagHooks.tagsIsError = true;

    render(<TagsSettings />);

    expect(screen.getByText("Tags unavailable.")).toHaveAttribute("data-tags-settings-state", "error");
    expect(screen.queryByText("tags.empty_state")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Delete/ })).not.toBeInTheDocument();
  });

  it.each([
    {
      outcome: "failure",
      settle: () => tagHooks.createTagMutateAsync.mockRejectedValueOnce(new Error("boom")),
      toast: { message: "Failed to create tag: boom", severity: "error" },
    },
    { outcome: "success", settle: () => tagHooks.createTagMutateAsync.mockResolvedValueOnce({}), toast: "Tag created" },
  ])("toasts tag creation $outcome with the matching severity", async ({ settle, toast }) => {
    const user = userEvent.setup();
    const showToast = vi.fn();
    settle();
    useUiStore.setState({ showToast });

    render(<TagsSettings />);

    await user.type(screen.getByRole("textbox"), "Review");
    await user.click(screen.getByRole("button", { name: /^(Create|tags\.create)$/ }));

    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith(toast);
    });
  });

  it("does not reset or toast from a stale tag creation after the draft changes", async () => {
    const user = userEvent.setup();
    const showToast = vi.fn();
    const pendingCreate = createDeferred<unknown>();
    tagHooks.createTagMutateAsync.mockReturnValueOnce(pendingCreate.promise);
    useUiStore.setState({ showToast });

    render(<TagsSettings />);

    const nameInput = screen.getByRole("textbox");
    await user.type(nameInput, "Review");
    await user.click(screen.getByRole("button", { name: /^(Create|tags\.create)$/ }));

    await user.clear(nameInput);
    await user.type(nameInput, "Inbox");

    await act(async () => {
      pendingCreate.resolve({});
      await pendingCreate.promise;
    });

    expect(nameInput).toHaveValue("Inbox");
    expect(showToast).not.toHaveBeenCalled();
  });

  it("does not close or toast from a stale tag rename after the edit draft changes", async () => {
    const user = userEvent.setup();
    const showToast = vi.fn();
    const pendingRename = createDeferred<unknown>();
    tagHooks.tagsData = [{ id: "tag-1", name: "Review", color: null }];
    tagHooks.renameTagMutateAsync.mockReturnValueOnce(pendingRename.promise);
    useUiStore.setState({ showToast });

    render(<TagsSettings />);

    await user.click(screen.getByRole("button", { name: /Edit/ }));
    const dialog = screen.getByRole("dialog");
    const nameInput = within(dialog).getByRole("textbox");
    await user.clear(nameInput);
    await user.type(nameInput, "Reading");
    await user.click(within(dialog).getByRole("button", { name: /^(Save|common\.save)$/ }));

    await user.clear(nameInput);
    await user.type(nameInput, "Current Draft");

    await act(async () => {
      pendingRename.resolve({});
      await pendingRename.promise;
    });

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(nameInput).toHaveValue("Current Draft");
    expect(showToast).not.toHaveBeenCalled();
  });

  it("trims tag rename drafts before saving", async () => {
    const user = userEvent.setup();
    tagHooks.tagsData = [{ id: "tag-1", name: "Review", color: null }];
    tagHooks.renameTagMutateAsync.mockResolvedValueOnce({});

    render(<TagsSettings />);

    await user.click(screen.getByRole("button", { name: /Edit/ }));
    const dialog = screen.getByRole("dialog");
    const nameInput = within(dialog).getByRole("textbox");
    await user.clear(nameInput);
    await user.type(nameInput, "  Reading  ");
    await user.click(within(dialog).getByRole("button", { name: /^(Save|common\.save)$/ }));

    await waitFor(() => {
      expect(tagHooks.renameTagMutateAsync).toHaveBeenCalledWith({
        tagId: "tag-1",
        name: "Reading",
        color: "#cf7868",
      });
    });
  });

  it("saves the visible default color when editing an existing tag without a color", async () => {
    const user = userEvent.setup();
    tagHooks.tagsData = [{ id: "tag-1", name: "Review", color: null }];
    tagHooks.renameTagMutateAsync.mockResolvedValueOnce({});

    render(<TagsSettings />);

    await user.click(screen.getByRole("button", { name: /Edit/ }));
    const dialog = screen.getByRole("dialog");
    const nameInput = within(dialog).getByRole("textbox");
    expect(within(dialog).getByRole("radio", { name: "Color #cf7868" })).toBeChecked();

    await user.clear(nameInput);
    await user.type(nameInput, "Reading");
    await user.click(within(dialog).getByRole("button", { name: /^(Save|common\.save)$/ }));

    await waitFor(() => {
      expect(tagHooks.renameTagMutateAsync).toHaveBeenCalledWith({
        tagId: "tag-1",
        name: "Reading",
        color: "#cf7868",
      });
    });
  });

  it("saves tag color changes from the edit dialog", async () => {
    const user = userEvent.setup();
    tagHooks.tagsData = [{ id: "tag-1", name: "Review", color: "#cf7868" }];
    tagHooks.renameTagMutateAsync.mockResolvedValueOnce({});

    render(<TagsSettings />);

    await user.click(screen.getByRole("button", { name: /Edit/ }));
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("radio", { name: "Color #6f8eb8" }));
    await user.click(within(dialog).getByRole("button", { name: /^(Save|common\.save)$/ }));

    await waitFor(() => {
      expect(tagHooks.renameTagMutateAsync).toHaveBeenCalledWith({
        tagId: "tag-1",
        name: "Review",
        color: "#6f8eb8",
      });
    });
  });

  it("does not show a no-color option in the edit dialog", async () => {
    const user = userEvent.setup();
    tagHooks.tagsData = [{ id: "tag-1", name: "Review", color: "#cf7868" }];

    render(<TagsSettings />);

    await user.click(screen.getByRole("button", { name: /Edit/ }));
    const dialog = screen.getByRole("dialog");

    expect(within(dialog).queryByRole("radio", { name: /No color|reader\.no_color/ })).not.toBeInTheDocument();
    expect(within(dialog).getByRole("radio", { name: "Color #cf7868" })).toBeChecked();
  });

  it("closes edit dialog without renaming when the target tag disappears", async () => {
    const user = userEvent.setup();
    const showToast = vi.fn();
    tagHooks.tagsData = [{ id: "tag-1", name: "Review", color: null }];
    useUiStore.setState({ showToast });

    const { rerender } = render(<TagsSettings />);

    await user.click(screen.getByRole("button", { name: /Edit/ }));
    const dialog = screen.getByRole("dialog");
    const nameInput = within(dialog).getByRole("textbox");
    await user.clear(nameInput);
    await user.type(nameInput, "Reading");

    tagHooks.tagsData = [];
    rerender(<TagsSettings />);

    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: /^(Save|common\.save)$/,
      }),
    );

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(tagHooks.renameTagMutateAsync).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Failed to update tag: This tag was already removed.", severity: "error" }),
    );
  });

  it("keeps delete dialog visible but disabled when the target tag disappears", async () => {
    const user = userEvent.setup();
    const showToast = vi.fn();
    tagHooks.tagsData = [{ id: "tag-1", name: "Review", color: null }];
    useUiStore.setState({ showToast });

    const { rerender } = render(<TagsSettings />);

    await user.click(screen.getByRole("button", { name: /Delete/ }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    tagHooks.tagsData = [];
    rerender(<TagsSettings />);

    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: 'Delete "Review". This cannot be undone.',
      }),
    );

    const deleteButton = within(screen.getByRole("dialog")).getByRole("button", {
      name: 'Delete "Review". This cannot be undone.',
    });
    expect(deleteButton).toBeDisabled();
    expect(deleteButton).toHaveAccessibleDescription(
      "The tag could not be reloaded. Deleting is disabled until the target is known.",
    );
    expect(tagHooks.deleteTagMutateAsync).not.toHaveBeenCalled();
    expect(showToast).not.toHaveBeenCalled();
  });

  it("keeps a tag creation failure visible in the create section, not only in the toast", async () => {
    const user = userEvent.setup();
    tagHooks.createTagMutateAsync.mockRejectedValueOnce(new Error("name already used"));

    render(<TagsSettings />);

    const nameInput = screen.getByRole("textbox");
    await user.type(nameInput, "Review");
    await user.click(screen.getByRole("button", { name: /^(Create|tags\.create)$/ }));

    const createForm = nameInput.closest("form");
    if (!createForm) {
      throw new Error("Expected tag creation input to be inside a form");
    }
    expect(await within(createForm).findByRole("alert")).toHaveTextContent("Failed to create tag: name already used");
  });

  it("clears the creation failure when the user edits the tag name", async () => {
    const user = userEvent.setup();
    tagHooks.createTagMutateAsync.mockRejectedValueOnce(new Error("name already used"));

    render(<TagsSettings />);

    const nameInput = screen.getByRole("textbox");
    await user.type(nameInput, "Review");
    await user.click(screen.getByRole("button", { name: /^(Create|tags\.create)$/ }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();

    await user.type(nameInput, "s");

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("keeps a tag rename failure visible in the edit dialog, not only in the toast", async () => {
    const user = userEvent.setup();
    tagHooks.tagsData = [{ id: "tag-1", name: "Review", color: null }];
    tagHooks.renameTagMutateAsync.mockRejectedValueOnce(new Error("database is locked"));

    render(<TagsSettings />);

    await user.click(screen.getByRole("button", { name: /Edit/ }));
    const dialog = screen.getByRole("dialog");
    const nameInput = within(dialog).getByRole("textbox");
    await user.clear(nameInput);
    await user.type(nameInput, "Reading");
    await user.click(within(dialog).getByRole("button", { name: /^(Save|common\.save)$/ }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Failed to update tag: database is locked");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("clears the rename failure when the user edits the tag name in the dialog", async () => {
    const user = userEvent.setup();
    tagHooks.tagsData = [{ id: "tag-1", name: "Review", color: null }];
    tagHooks.renameTagMutateAsync.mockRejectedValueOnce(new Error("database is locked"));

    render(<TagsSettings />);

    await user.click(screen.getByRole("button", { name: /Edit/ }));
    const dialog = screen.getByRole("dialog");
    const nameInput = within(dialog).getByRole("textbox");
    await user.clear(nameInput);
    await user.type(nameInput, "Reading");
    await user.click(within(dialog).getByRole("button", { name: /^(Save|common\.save)$/ }));
    expect(await within(dialog).findByRole("alert")).toBeInTheDocument();

    await user.type(nameInput, "!");

    expect(within(dialog).queryByRole("alert")).not.toBeInTheDocument();
  });

  it("keeps a tag delete failure visible in the delete dialog, not only in the toast", async () => {
    const user = userEvent.setup();
    tagHooks.tagsData = [{ id: "tag-1", name: "Review", color: null }];
    tagHooks.deleteTagMutateAsync.mockRejectedValueOnce(new Error("database is locked"));

    render(<TagsSettings />);

    await user.click(screen.getByRole("button", { name: /Delete/ }));
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: 'Delete "Review". This cannot be undone.' }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Failed to delete tag: database is locked");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("does not show a stale delete failure after the dialog is closed and reopened", async () => {
    const user = userEvent.setup();
    tagHooks.tagsData = [{ id: "tag-1", name: "Review", color: null }];
    tagHooks.deleteTagMutateAsync.mockRejectedValueOnce(new Error("database is locked"));

    render(<TagsSettings />);

    await user.click(screen.getByRole("button", { name: /Delete/ }));
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: 'Delete "Review". This cannot be undone.' }),
    );
    expect(await screen.findByRole("alert")).toBeInTheDocument();

    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: /^(Cancel|common\.cancel)$/ }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /Delete/ }));

    expect(within(screen.getByRole("dialog")).queryByRole("alert")).not.toBeInTheDocument();
  });
});
