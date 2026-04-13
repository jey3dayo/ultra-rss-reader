import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { ArticleTagPickerView } from "@/components/reader/article-tag-picker-view";
import articleTagPickerViewSource from "@/components/reader/article-tag-picker-view.tsx?raw";

describe("ArticleTagPickerView", () => {
  it("renders assigned tags and forwards remove and assign actions", async () => {
    const user = userEvent.setup();
    const onExpandedChange = vi.fn();
    const onNewTagNameChange = vi.fn();
    const onAssignTag = vi.fn();
    const onRemoveTag = vi.fn();
    const onCreateTag = vi.fn();

    render(
      <ArticleTagPickerView
        assignedTags={[{ id: "tag-1", name: "Later", color: null }]}
        availableTags={[{ id: "tag-2", name: "Important", color: "#ff0000" }]}
        newTagName=""
        isExpanded
        labels={{
          addTag: "Add tag",
          availableTags: "Available tags",
          newTagPlaceholder: "Create tag",
          createTag: "Create tag",
          removeTag: (name) => `Remove tag ${name}`,
        }}
        onExpandedChange={onExpandedChange}
        onNewTagNameChange={onNewTagNameChange}
        onAssignTag={onAssignTag}
        onRemoveTag={onRemoveTag}
        onCreateTag={onCreateTag}
      />,
    );

    const removeButton = screen.getByRole("button", { name: "Remove tag Later" });
    expect(removeButton).toHaveClass("size-6");
    expect(screen.getByText("Tags")).toBeInTheDocument();
    expect(screen.getByText("Add and organize article tags")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add tag" })).toHaveClass("h-8");

    await user.click(removeButton);
    await user.click(screen.getByRole("option", { name: "Important" }));

    expect(onRemoveTag).toHaveBeenCalledWith("tag-1");
    expect(onAssignTag).toHaveBeenCalledWith("tag-2");
    expect(onExpandedChange).toHaveBeenCalledWith(false);
    expect(onNewTagNameChange).not.toHaveBeenCalled();
    expect(onCreateTag).not.toHaveBeenCalled();
  });

  it("requests expand and close state changes from trigger and escape", async () => {
    const user = userEvent.setup();
    const onExpandedChange = vi.fn();

    const { rerender } = render(
      <ArticleTagPickerView
        assignedTags={[]}
        availableTags={[{ id: "tag-1", name: "Later", color: null }]}
        newTagName=""
        isExpanded={false}
        labels={{
          addTag: "Add tag",
          availableTags: "Available tags",
          newTagPlaceholder: "Create tag",
          createTag: "Create tag",
          removeTag: (name) => `Remove tag ${name}`,
        }}
        onExpandedChange={onExpandedChange}
        onNewTagNameChange={vi.fn()}
        onAssignTag={vi.fn()}
        onRemoveTag={vi.fn()}
        onCreateTag={vi.fn()}
      />,
    );

    const trigger = screen.getByRole("button", { name: "Add tag" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    await user.click(trigger);

    expect(onExpandedChange).toHaveBeenCalledWith(true);

    rerender(
      <ArticleTagPickerView
        assignedTags={[]}
        availableTags={[{ id: "tag-1", name: "Later", color: null }]}
        newTagName=""
        isExpanded
        labels={{
          addTag: "Add tag",
          availableTags: "Available tags",
          newTagPlaceholder: "Create tag",
          createTag: "Create tag",
          removeTag: (name) => `Remove tag ${name}`,
        }}
        onExpandedChange={onExpandedChange}
        onNewTagNameChange={vi.fn()}
        onAssignTag={vi.fn()}
        onRemoveTag={vi.fn()}
        onCreateTag={vi.fn()}
      />,
    );

    const listbox = screen.getByRole("listbox", { name: "Available tags" });
    expect(trigger).toHaveAttribute("aria-expanded", "true");

    await user.click(screen.getByRole("textbox", { name: "" }));
    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(onExpandedChange).toHaveBeenCalledWith(false);
    });

    expect(listbox).toBeInTheDocument();
  });

  it("updates the draft tag name and creates a trimmed tag from the keyboard", async () => {
    const user = userEvent.setup();
    const onNewTagNameChange = vi.fn();
    const onCreateTag = vi.fn();

    function ControlledPicker() {
      const [newTagName, setNewTagName] = useState("  Follow up  ");

      return (
        <ArticleTagPickerView
          assignedTags={[]}
          availableTags={[]}
          newTagName={newTagName}
          isExpanded
          labels={{
            addTag: "Add tag",
            availableTags: "Available tags",
            newTagPlaceholder: "Create tag",
            createTag: "Create tag",
            removeTag: (name) => `Remove tag ${name}`,
          }}
          onExpandedChange={vi.fn()}
          onNewTagNameChange={(value) => {
            onNewTagNameChange(value);
            setNewTagName(value);
          }}
          onAssignTag={vi.fn()}
          onRemoveTag={vi.fn()}
          onCreateTag={onCreateTag}
        />
      );
    }

    render(<ControlledPicker />);

    const input = screen.getByPlaceholderText("Create tag");

    await user.clear(input);
    await user.type(input, "Fresh");
    expect(onNewTagNameChange).toHaveBeenLastCalledWith("Fresh");

    await user.keyboard("{Enter}");

    expect(onCreateTag).toHaveBeenCalledWith("Fresh");
  });

  it("keeps the view independent from the tauri api layer", () => {
    expect(articleTagPickerViewSource).not.toContain("@/api/tauri-commands");
    expect(articleTagPickerViewSource).toContain(
      'import type { ArticleTagPickerViewProps } from "./article-tag-picker.types"',
    );
  });

  it("keeps the tag section heading visible even when there are no assigned tags", () => {
    render(
      <ArticleTagPickerView
        assignedTags={[]}
        availableTags={[]}
        newTagName=""
        isExpanded={false}
        labels={{
          addTag: "Add tag",
          availableTags: "Available tags",
          newTagPlaceholder: "Create tag",
          createTag: "Create tag",
          removeTag: (name) => `Remove tag ${name}`,
        }}
        onExpandedChange={vi.fn()}
        onNewTagNameChange={vi.fn()}
        onAssignTag={vi.fn()}
        onRemoveTag={vi.fn()}
        onCreateTag={vi.fn()}
      />,
    );

    expect(screen.getByText("Tags")).toBeInTheDocument();
    expect(screen.getByText("Add and organize article tags")).toBeInTheDocument();
  });

  it("does not steal focus again when available tags change while open", async () => {
    const user = userEvent.setup();

    const { rerender } = render(
      <ArticleTagPickerView
        assignedTags={[]}
        availableTags={[
          { id: "tag-1", name: "Later", color: null },
          { id: "tag-2", name: "Important", color: "#ff0000" },
        ]}
        newTagName=""
        isExpanded
        labels={{
          addTag: "Add tag",
          availableTags: "Available tags",
          newTagPlaceholder: "Create tag",
          createTag: "Create tag",
          removeTag: (name) => `Remove tag ${name}`,
        }}
        onExpandedChange={vi.fn()}
        onNewTagNameChange={vi.fn()}
        onAssignTag={vi.fn()}
        onRemoveTag={vi.fn()}
        onCreateTag={vi.fn()}
      />,
    );

    const input = screen.getByRole("textbox");
    await user.click(input);
    expect(input).toHaveFocus();

    rerender(
      <ArticleTagPickerView
        assignedTags={[]}
        availableTags={[{ id: "tag-1", name: "Later", color: null }]}
        newTagName=""
        isExpanded
        labels={{
          addTag: "Add tag",
          availableTags: "Available tags",
          newTagPlaceholder: "Create tag",
          createTag: "Create tag",
          removeTag: (name) => `Remove tag ${name}`,
        }}
        onExpandedChange={vi.fn()}
        onNewTagNameChange={vi.fn()}
        onAssignTag={vi.fn()}
        onRemoveTag={vi.fn()}
        onCreateTag={vi.fn()}
      />,
    );

    expect(input).toHaveFocus();
  });
});
