import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TagsSettings } from "@/components/settings/tags-settings";
import { useUiStore } from "@/stores/ui-store";

const tagHooks = vi.hoisted(() => ({
  tagsData: [] as Array<{ id: string; name: string; color: string | null }>,
  tagsIsError: false,
  createTagMutateAsync: vi.fn<(input: { name: string; color?: string }) => Promise<unknown>>(),
  renameTagMutateAsync: vi.fn<(input: { tagId: string; name: string; color?: string | null }) => Promise<unknown>>(),
  deleteTagMutateAsync: vi.fn<(input: { tagId: string }) => Promise<unknown>>(),
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

describe("TagsSettings", () => {
  beforeEach(() => {
    tagHooks.tagsData = [];
    tagHooks.tagsIsError = false;
    tagHooks.createTagMutateAsync.mockReset();
    tagHooks.renameTagMutateAsync.mockReset();
    tagHooks.deleteTagMutateAsync.mockReset();
    tagHooks.createTagMutateAsync.mockReturnValue(new Promise(() => {}));
    useUiStore.setState(useUiStore.getInitialState());
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
      color: undefined,
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
      color: undefined,
    });
  });

  it("shows tag load failure separately from the true empty state", () => {
    tagHooks.tagsIsError = true;

    render(<TagsSettings />);

    expect(screen.getByText("Tags unavailable.")).toHaveAttribute("data-tags-settings-state", "error");
    expect(screen.queryByText("tags.empty_state")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Delete/ })).not.toBeInTheDocument();
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
        color: null,
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

  it("clears tag color from the edit dialog", async () => {
    const user = userEvent.setup();
    tagHooks.tagsData = [{ id: "tag-1", name: "Review", color: "#cf7868" }];
    tagHooks.renameTagMutateAsync.mockResolvedValueOnce({});

    render(<TagsSettings />);

    await user.click(screen.getByRole("button", { name: /Edit/ }));
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("radio", { name: /No color|reader\.no_color/ }));
    await user.click(within(dialog).getByRole("button", { name: /^(Save|common\.save)$/ }));

    await waitFor(() => {
      expect(tagHooks.renameTagMutateAsync).toHaveBeenCalledWith({
        tagId: "tag-1",
        name: "Review",
        color: null,
      });
    });
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
    expect(showToast).toHaveBeenCalledWith("Failed to update tag: Tag no longer exists.");
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
});

function createDeferred<T>() {
  let resolve: (value: T) => void = () => {};
  let reject: (reason?: unknown) => void = () => {};
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, resolve, reject };
}
