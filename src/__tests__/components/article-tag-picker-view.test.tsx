import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { TagOptionRowButton, TagPickerTriggerButton } from "@/components/reader/article-tag-picker-buttons";
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

    const removeButton = screen.getByRole("button", {
      name: "Remove tag Later",
    });
    const addTagButton = screen.getByRole("button", { name: "Add tag" });
    expect(removeButton).toHaveClass("size-4");
    expect(screen.queryByText("Tags")).not.toBeInTheDocument();
    expect(addTagButton).not.toHaveClass("size-8");
    expect(addTagButton).toHaveClass("motion-interactive-surface");
    expect(addTagButton).toHaveClass("min-h-6", "rounded-md", "border", "bg-surface-2/88", "text-foreground");
    expect(screen.getByRole("listbox", { name: "Available tags" }).closest("[data-open]")).toHaveClass(
      "motion-popup-surface",
      "rounded-lg",
      "bg-surface-2",
      "shadow-elevation-3",
    );
    expect(screen.getByRole("option", { name: "Important" })).toHaveClass("min-h-11", "rounded-md");
    expect(screen.getByRole("option", { name: "Important" })).toHaveClass("motion-static-hover-surface");
    expect(screen.getByRole("option", { name: "Important" })).toHaveClass("hover:bg-surface-1/72");
    expect(screen.getByRole("textbox", { name: "Create tag" })).toHaveClass("h-11");
    expect(screen.getByRole("textbox", { name: "Create tag" })).toHaveClass(
      "focus-visible:ring-2",
      "focus-visible:ring-ring/60",
    );
    expect(screen.getByRole("textbox", { name: "Create tag" }).closest("div.flex.min-w-0.flex-col")).toHaveClass(
      "sm:flex-row",
      "sm:items-center",
    );
    expect(screen.getByRole("button", { name: "Create tag" })).toHaveClass("size-11", "rounded-md");
    expect(screen.getByRole("button", { name: "Create tag" })).toHaveClass(
      "text-foreground-soft",
      "hover:bg-surface-1/72",
    );

    await user.click(removeButton);
    onExpandedChange.mockClear();
    await user.click(screen.getByRole("option", { name: "Important" }));

    expect(onRemoveTag).toHaveBeenCalledWith("tag-1");
    expect(onAssignTag).toHaveBeenCalledWith("tag-2");
    expect(onExpandedChange).not.toHaveBeenCalled();
    expect(onNewTagNameChange).not.toHaveBeenCalled();
    expect(onCreateTag).not.toHaveBeenCalled();
  });

  it("keeps the picker popover inside a narrow viewport", async () => {
    const getBoundingClientRectSpy = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockImplementation(function getBoundingClientRectMock(this: HTMLElement) {
        if (this.hasAttribute("data-open")) {
          return {
            x: 260,
            y: 40,
            width: 260,
            height: 120,
            top: 40,
            right: 520,
            bottom: 160,
            left: 260,
            toJSON: () => ({}),
          };
        }

        return {
          x: 0,
          y: 0,
          width: 0,
          height: 0,
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
          toJSON: () => ({}),
        };
      });
    const originalInnerWidth = window.innerWidth;
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 320 });

    render(
      <ArticleTagPickerView
        assignedTags={[{ id: "tag-1", name: "Later", color: null }]}
        availableTags={[{ id: "tag-2", name: "Important", color: "#ff0000" }]}
        newTagName=""
        isExpanded
        labels={{
          addTag: "Add tag",
          availableTags: "Available tags",
          newTagPlaceholder: "New tag name",
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

    const listbox = screen.getByRole("listbox", { name: "Available tags" });
    expect(listbox.closest("[data-open]")).toHaveClass("max-w-[calc(100vw-1rem)]");
    expect(screen.getByRole("textbox", { name: "New tag name" })).toBeInTheDocument();
    await waitFor(() => {
      expect(listbox.closest("[data-open]")).toHaveStyle({ marginLeft: "-208px" });
    });

    Object.defineProperty(window, "innerWidth", { configurable: true, value: originalInnerWidth });
    getBoundingClientRectSpy.mockRestore();
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
          sectionHint: "Add and organize article tags",
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
    expect(trigger).toHaveTextContent("Add tag");
    expect(trigger).toHaveClass("min-h-6", "rounded-md");
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
    expect(trigger).toHaveClass("bg-surface-2/88", "text-foreground");

    await user.click(screen.getByRole("textbox", { name: "Create tag" }));
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

  it("keeps text editing keys inside the new tag input instead of roving listbox focus", async () => {
    const user = userEvent.setup();

    render(
      <ArticleTagPickerView
        assignedTags={[]}
        availableTags={[{ id: "tag-1", name: "Important", color: "#ff0000" }]}
        newTagName="Fresh"
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

    const input = screen.getByRole("textbox", { name: "Create tag" });
    const option = screen.getByRole("option", { name: "Important" });
    await user.click(input);

    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "ArrowUp" });
    fireEvent.keyDown(input, { key: "Home" });
    fireEvent.keyDown(input, { key: "End" });

    expect(input).toHaveFocus();
    expect(option).not.toHaveFocus();
  });

  it("blocks empty and pending tag creation from the keyboard path", async () => {
    const user = userEvent.setup();
    const onCreateTag = vi.fn();

    const { rerender } = render(
      <ArticleTagPickerView
        assignedTags={[]}
        availableTags={[]}
        newTagName="   "
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
        onCreateTag={onCreateTag}
      />,
    );

    await user.click(screen.getByRole("textbox", { name: "Create tag" }));
    await user.keyboard("{Enter}");
    expect(onCreateTag).not.toHaveBeenCalled();

    rerender(
      <ArticleTagPickerView
        assignedTags={[]}
        availableTags={[]}
        newTagName="Review"
        isExpanded
        isCreateTagPending
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
        onCreateTag={onCreateTag}
      />,
    );

    expect(screen.getByRole("button", { name: "Create tag" })).toBeDisabled();
    await user.click(screen.getByRole("textbox", { name: "Create tag" }));
    await user.keyboard("{Enter}");
    expect(onCreateTag).not.toHaveBeenCalled();
  });

  it("associates new tag creation errors with the input", () => {
    render(
      <ArticleTagPickerView
        assignedTags={[]}
        availableTags={[]}
        newTagName="Review"
        newTagError="Tag already exists"
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

    const input = screen.getByRole("textbox", { name: "Create tag" });
    const error = screen.getByText("Tag already exists");

    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("aria-describedby", error.id);
    expect(error).toHaveClass("text-state-danger-foreground");
  });

  it("returns focus to the trigger and clears the draft when successful creation closes the picker", async () => {
    const user = userEvent.setup();
    const onCreateTag = vi.fn();

    function ControlledPicker() {
      const [isExpanded, setIsExpanded] = useState(true);
      const [newTagName, setNewTagName] = useState("");

      return (
        <ArticleTagPickerView
          assignedTags={[]}
          availableTags={[]}
          newTagName={newTagName}
          isExpanded={isExpanded}
          labels={{
            addTag: "Add tag",
            availableTags: "Available tags",
            newTagPlaceholder: "Create tag",
            createTag: "Create tag",
            removeTag: (name) => `Remove tag ${name}`,
          }}
          onExpandedChange={setIsExpanded}
          onNewTagNameChange={setNewTagName}
          onAssignTag={vi.fn()}
          onRemoveTag={vi.fn()}
          onCreateTag={(name) => {
            onCreateTag(name);
            setIsExpanded(false);
          }}
        />
      );
    }

    render(<ControlledPicker />);

    const input = screen.getByRole("textbox");
    await user.type(input, "Review");
    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(screen.queryByRole("listbox", { name: "Available tags" })).not.toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Add tag" })).toHaveFocus();
    });

    expect(onCreateTag).toHaveBeenCalledWith("Review");

    await user.keyboard("{Enter}");
    expect(screen.getByRole("textbox")).toHaveValue("");
  });

  it("clears the draft when the picker closes before reopening", async () => {
    const user = userEvent.setup();

    function ControlledPicker() {
      const [isExpanded, setIsExpanded] = useState(true);
      const [newTagName, setNewTagName] = useState("");

      return (
        <ArticleTagPickerView
          assignedTags={[]}
          availableTags={[]}
          newTagName={newTagName}
          isExpanded={isExpanded}
          labels={{
            addTag: "Add tag",
            availableTags: "Available tags",
            newTagPlaceholder: "Create tag",
            createTag: "Create tag",
            removeTag: (name) => `Remove tag ${name}`,
          }}
          onExpandedChange={setIsExpanded}
          onNewTagNameChange={setNewTagName}
          onAssignTag={vi.fn()}
          onRemoveTag={vi.fn()}
          onCreateTag={vi.fn()}
        />
      );
    }

    render(<ControlledPicker />);

    await user.type(screen.getByRole("textbox"), "Stale");
    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(screen.queryByRole("listbox", { name: "Available tags" })).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Add tag" }));
    expect(screen.getByRole("textbox")).toHaveValue("");

    await user.type(screen.getByRole("textbox"), "Outside");
    fireEvent.pointerDown(document.body);

    await waitFor(() => {
      expect(screen.queryByRole("listbox", { name: "Available tags" })).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Add tag" }));
    expect(screen.getByRole("textbox")).toHaveValue("");
  });

  it("cancels scheduled close focus restore after unmount", async () => {
    const user = userEvent.setup();
    const scheduledCallbacks = new Map<number, FrameRequestCallback>();
    let nextFrameId = 1;
    const requestAnimationFrameSpy = vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      const frameId = nextFrameId;
      nextFrameId += 1;
      scheduledCallbacks.set(frameId, callback);
      return frameId;
    });
    const cancelAnimationFrameSpy = vi.spyOn(window, "cancelAnimationFrame").mockImplementation((frameId) => {
      scheduledCallbacks.delete(frameId);
    });

    function ControlledPicker() {
      const [isExpanded, setIsExpanded] = useState(true);

      return (
        <ArticleTagPickerView
          assignedTags={[]}
          availableTags={[]}
          newTagName=""
          isExpanded={isExpanded}
          labels={{
            addTag: "Add tag",
            availableTags: "Available tags",
            newTagPlaceholder: "Create tag",
            createTag: "Create tag",
            removeTag: (name) => `Remove tag ${name}`,
          }}
          onExpandedChange={setIsExpanded}
          onNewTagNameChange={vi.fn()}
          onAssignTag={vi.fn()}
          onRemoveTag={vi.fn()}
          onCreateTag={vi.fn()}
        />
      );
    }

    const { unmount } = render(<ControlledPicker />);
    const trigger = screen.getByRole("button", { name: "Add tag" });
    const focusSpy = vi.spyOn(trigger, "focus");

    await user.click(screen.getByRole("textbox"));
    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(screen.queryByRole("listbox", { name: "Available tags" })).not.toBeInTheDocument();
    });

    const restoreFocusFrameId = nextFrameId - 1;
    const restoreFocusCallback = scheduledCallbacks.get(restoreFocusFrameId);
    expect(restoreFocusCallback).toBeDefined();

    unmount();
    restoreFocusCallback?.(0);

    expect(cancelAnimationFrameSpy).toHaveBeenCalledWith(restoreFocusFrameId);
    expect(focusSpy).not.toHaveBeenCalled();

    requestAnimationFrameSpy.mockRestore();
    cancelAnimationFrameSpy.mockRestore();
  });

  it("keeps the view independent from the tauri api layer", () => {
    expect(articleTagPickerViewSource).not.toContain("@/api/tauri-commands");
    expect(articleTagPickerViewSource).toContain('import type { TagViewItem } from "@/lib/tags.types"');
  });

  it("keeps tag picker wrapper refs attached to their native buttons", () => {
    const triggerRef = createRef<HTMLButtonElement>();
    const optionRef = createRef<HTMLButtonElement>();

    render(
      <>
        <TagPickerTriggerButton ref={triggerRef}>Add tag</TagPickerTriggerButton>
        <TagOptionRowButton ref={optionRef} swatchColor="#ff0000">
          Important
        </TagOptionRowButton>
      </>,
    );

    expect(triggerRef.current).toBe(screen.getByRole("button", { name: "Add tag" }));
    expect(optionRef.current).toBe(screen.getByRole("button", { name: "Important" }));
  });

  it("keeps the tag section heading visible even when there are no assigned tags", () => {
    render(
      <ArticleTagPickerView
        assignedTags={[]}
        availableTags={[]}
        newTagName=""
        isExpanded={false}
        labels={{
          sectionHint: "Add and organize article tags",
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
    expect(screen.queryByText("Add and organize article tags")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add tag" })).toBeInTheDocument();
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

  it("closes the picker when an open option list loses tags", async () => {
    const onExpandedChange = vi.fn();

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
        onExpandedChange={onExpandedChange}
        onNewTagNameChange={vi.fn()}
        onAssignTag={vi.fn()}
        onRemoveTag={vi.fn()}
        onCreateTag={vi.fn()}
      />,
    );

    expect(screen.getByRole("option", { name: "Important" })).toBeInTheDocument();

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

    expect(onExpandedChange).toHaveBeenCalledWith(false);
  });

  it("supports Arrow, Home, and End listbox navigation across available tags", async () => {
    const user = userEvent.setup();

    render(
      <ArticleTagPickerView
        assignedTags={[]}
        availableTags={[
          { id: "tag-1", name: "Later", color: null },
          { id: "tag-2", name: "Important", color: "#ff0000" },
          { id: "tag-3", name: "Archive", color: null },
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

    const listbox = screen.getByRole("listbox", { name: "Available tags" });
    const firstOption = screen.getByRole("option", { name: "Later" });
    const middleOption = screen.getByRole("option", { name: "Important" });
    const lastOption = screen.getByRole("option", { name: "Archive" });

    await waitFor(() => {
      expect(firstOption).toHaveFocus();
    });

    middleOption.focus();
    expect(middleOption).toHaveFocus();

    await user.keyboard("{ArrowDown}");
    expect(lastOption).toHaveFocus();

    await user.keyboard("{ArrowUp}");
    expect(middleOption).toHaveFocus();

    await user.keyboard("{End}");
    expect(lastOption).toHaveFocus();

    await user.keyboard("{Home}");
    expect(firstOption).toHaveFocus();
    expect(listbox).toBeInTheDocument();
  });
});
