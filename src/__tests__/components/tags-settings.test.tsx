import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TagsSettings } from "@/components/settings/tags-settings";
import { useUiStore } from "@/stores/ui-store";

const tagHooks = vi.hoisted(() => ({
  createTagMutateAsync: vi.fn<(input: { name: string; color?: string }) => Promise<unknown>>(),
  renameTagMutateAsync: vi.fn<(input: { tagId: string; name: string; color?: string | null }) => Promise<unknown>>(),
  deleteTagMutateAsync: vi.fn<(input: { tagId: string }) => Promise<unknown>>(),
}));

vi.mock("@/hooks/use-tags", () => ({
  useTags: () => ({ data: [] }),
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
    const createButton = screen.getByRole("button", { name: /^(Create|tags\.create)$/ });

    await waitFor(() => {
      expect(createButton).toBeEnabled();
    });

    if (!form) {
      throw new Error("Expected tag creation input to be inside a form");
    }

    fireEvent.click(createButton);
    fireEvent.submit(form);

    expect(tagHooks.createTagMutateAsync).toHaveBeenCalledTimes(1);
    expect(tagHooks.createTagMutateAsync).toHaveBeenCalledWith({ name: "Review", color: undefined });
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
    expect(tagHooks.createTagMutateAsync).toHaveBeenCalledWith({ name: "Review", color: undefined });
  });
});
