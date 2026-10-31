import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useArticleTagPickerPopover } from "@/components/reader/hooks/article/use-article-tag-picker-popover";

type HookHarnessProps = {
  availableTagCount: number;
  availableTagIds?: readonly string[];
  onExpandedChange: (expanded: boolean) => void;
  onParentKeyDown: () => void;
  isExpanded?: boolean;
};

function HookHarness({
  availableTagCount,
  availableTagIds,
  onExpandedChange,
  onParentKeyDown,
  isExpanded = true,
}: HookHarnessProps) {
  const tagIds = availableTagIds ?? Array.from({ length: availableTagCount }, (_, index) => `tag-${index + 1}`);
  const tags = tagIds.map((id, index) => ({
    id,
    name: id.startsWith("tag-") ? `Tag ${id.slice("tag-".length)}` : `Tag ${index + 1}`,
  }));
  const { pickerRef, triggerRef, newTagInputRef, tagOptionRefs, handleTagOptionFocus, handleListboxKeyDown } =
    useArticleTagPickerPopover({
      isExpanded,
      availableTagIds: tags.map((tag) => tag.id),
      availableTagCount,
      onExpandedChange,
      onNewTagNameChange: vi.fn(),
    });

  return (
    <>
      <button type="button">External button</button>
      <input aria-label="External input" />
      <section ref={pickerRef} aria-label="Tag picker harness" onKeyDown={onParentKeyDown}>
        <span>Tag picker harness</span>
        <button ref={triggerRef} type="button">
          Tag picker trigger
        </button>
        {isExpanded ? (
          <>
            <div role="listbox" aria-label="Available tags" onKeyDown={handleListboxKeyDown}>
              {tags.map((tag, index) => (
                <button
                  key={tag.id}
                  ref={(element) => {
                    tagOptionRefs.current[index] = element;
                  }}
                  onFocus={() => handleTagOptionFocus(tag.id)}
                  type="button"
                  role="option"
                  aria-selected="false"
                >
                  {tag.name}
                </button>
              ))}
            </div>
            <input ref={newTagInputRef} aria-label="Picker input" />
          </>
        ) : null}
      </section>
    </>
  );
}

describe("useArticleTagPickerPopover", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.replaceChildren();
  });

  it("owns Escape, Arrow, Home, and End listbox keyboard behavior", () => {
    const onExpandedChange = vi.fn();
    const onParentKeyDown = vi.fn();

    render(<HookHarness availableTagCount={3} onExpandedChange={onExpandedChange} onParentKeyDown={onParentKeyDown} />);

    const listbox = screen.getByRole("listbox", { name: "Available tags" });
    const firstOption = screen.getByRole("option", { name: "Tag 1" });
    const middleOption = screen.getByRole("option", { name: "Tag 2" });
    const lastOption = screen.getByRole("option", { name: "Tag 3" });

    middleOption.focus();
    expect(middleOption).toHaveFocus();

    expect(fireEvent.keyDown(listbox, { key: "End" })).toBe(false);
    expect(lastOption).toHaveFocus();

    expect(fireEvent.keyDown(listbox, { key: "Home" })).toBe(false);
    expect(firstOption).toHaveFocus();

    expect(fireEvent.keyDown(listbox, { key: "ArrowUp" })).toBe(false);
    expect(lastOption).toHaveFocus();

    expect(fireEvent.keyDown(listbox, { key: "ArrowDown" })).toBe(false);
    expect(firstOption).toHaveFocus();

    expect(fireEvent.keyDown(listbox, { key: "Escape" })).toBe(false);
    expect(onExpandedChange).toHaveBeenCalledWith(false);
    expect(onParentKeyDown).not.toHaveBeenCalled();
  });

  it("closes only from the picker owner document on outside pointerdown", () => {
    const onExpandedChange = vi.fn();
    const ownerDocument = document.implementation.createHTMLDocument("tag picker portal owner");

    render(<HookHarness availableTagCount={1} onExpandedChange={onExpandedChange} onParentKeyDown={vi.fn()} />, {
      container: ownerDocument.body,
    });

    fireEvent.pointerDown(document.body);
    expect(onExpandedChange).not.toHaveBeenCalled();

    ownerDocument.body.dispatchEvent(new Event("pointerdown", { bubbles: true, composed: true }));
    expect(onExpandedChange).toHaveBeenCalledWith(false);
  });

  it("closes from the picker owner document on outside touchstart", () => {
    const onExpandedChange = vi.fn();

    render(<HookHarness availableTagCount={1} onExpandedChange={onExpandedChange} onParentKeyDown={vi.fn()} />);

    fireEvent.touchStart(document.body);
    expect(onExpandedChange).toHaveBeenCalledWith(false);
  });

  it("keeps the popover mounted when outside-click listener binding fails", () => {
    const error = new Error("document listener blocked");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(document, "addEventListener").mockImplementation((type, listener, options) => {
      if (type === "pointerdown") {
        throw error;
      }

      return EventTarget.prototype.addEventListener.call(document, type, listener, options);
    });

    expect(() =>
      render(<HookHarness availableTagCount={1} onExpandedChange={vi.fn()} onParentKeyDown={vi.fn()} />),
    ).not.toThrow();

    expect(warn).toHaveBeenCalledWith("Failed to bind article tag picker outside-click listener.", error);
  });

  it("cancels the opening focus frame before it can focus a stale tag option", () => {
    const scheduledCallbacks: FrameRequestCallback[] = [];
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      scheduledCallbacks.push(callback);
      return 42;
    });
    const cancelAnimationFrameSpy = vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);

    const { unmount } = render(
      <HookHarness availableTagCount={1} onExpandedChange={vi.fn()} onParentKeyDown={vi.fn()} />,
    );
    const option = screen.getByRole("option", { name: "Tag 1" });
    const focusSpy = vi.spyOn(option, "focus");

    unmount();
    const frameCallback = scheduledCallbacks[0];
    if (!frameCallback) {
      throw new Error("Expected scheduled focus callback");
    }
    frameCallback(0);

    expect(cancelAnimationFrameSpy).toHaveBeenCalledWith(42);
    expect(focusSpy).not.toHaveBeenCalled();
  });

  it("keeps the opening focus when the candidate array changes before the frame", () => {
    const scheduledCallbacks = new Map<number, FrameRequestCallback>();
    const canceledFrames = new Set<number>();
    let nextFrameId = 0;
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      const frameId = ++nextFrameId;
      scheduledCallbacks.set(frameId, callback);
      return frameId;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation((frameId) => {
      canceledFrames.add(frameId);
    });

    const { rerender } = render(
      <HookHarness
        availableTagCount={2}
        availableTagIds={["tag-1", "tag-2"]}
        onExpandedChange={vi.fn()}
        onParentKeyDown={vi.fn()}
      />,
    );

    rerender(
      <HookHarness
        availableTagCount={2}
        availableTagIds={["tag-1", "tag-2"]}
        onExpandedChange={vi.fn()}
        onParentKeyDown={vi.fn()}
      />,
    );

    act(() => {
      for (const [frameId, callback] of scheduledCallbacks) {
        if (!canceledFrames.has(frameId)) {
          callback(0);
        }
      }
    });

    expect(screen.getByRole("option", { name: "Tag 1" })).toHaveFocus();
  });

  it("focuses the current active tag when the opening candidates change before the frame", () => {
    const scheduledCallbacks = new Map<number, FrameRequestCallback>();
    const canceledFrames = new Set<number>();
    let nextFrameId = 0;
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      const frameId = ++nextFrameId;
      scheduledCallbacks.set(frameId, callback);
      return frameId;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation((frameId) => {
      canceledFrames.add(frameId);
    });

    const { rerender } = render(
      <HookHarness
        availableTagCount={2}
        availableTagIds={["tag-1", "tag-2"]}
        onExpandedChange={vi.fn()}
        onParentKeyDown={vi.fn()}
      />,
    );

    rerender(
      <HookHarness
        availableTagCount={2}
        availableTagIds={["tag-2", "tag-3"]}
        onExpandedChange={vi.fn()}
        onParentKeyDown={vi.fn()}
      />,
    );

    act(() => {
      for (const [frameId, callback] of scheduledCallbacks) {
        if (!canceledFrames.has(frameId)) {
          callback(0);
        }
      }
    });

    expect(screen.getByRole("option", { name: "Tag 2" })).toHaveFocus();
  });

  it("closes and restores trigger focus when the focused candidate disappears from a shrinking list", async () => {
    const onExpandedChange = vi.fn();
    const { rerender } = render(
      <HookHarness
        availableTagCount={3}
        availableTagIds={["tag-1", "tag-2", "tag-3"]}
        onExpandedChange={onExpandedChange}
        onParentKeyDown={vi.fn()}
      />,
    );

    screen.getByRole("option", { name: "Tag 2" }).focus();
    rerender(
      <HookHarness
        availableTagCount={2}
        availableTagIds={["tag-1", "tag-3"]}
        onExpandedChange={onExpandedChange}
        onParentKeyDown={vi.fn()}
      />,
    );

    expect(onExpandedChange).toHaveBeenCalledWith(false);

    rerender(
      <HookHarness
        availableTagCount={2}
        availableTagIds={["tag-1", "tag-3"]}
        isExpanded={false}
        onExpandedChange={onExpandedChange}
        onParentKeyDown={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Tag picker trigger" })).toHaveFocus();
    });
  });

  it("moves focus to the same position when the focused candidate is replaced without shrinking the list", () => {
    const onExpandedChange = vi.fn();
    const { rerender } = render(
      <HookHarness
        availableTagCount={3}
        availableTagIds={["tag-1", "tag-2", "tag-3"]}
        onExpandedChange={onExpandedChange}
        onParentKeyDown={vi.fn()}
      />,
    );

    screen.getByRole("option", { name: "Tag 2" }).focus();
    rerender(
      <HookHarness
        availableTagCount={3}
        availableTagIds={["tag-1", "tag-4", "tag-3"]}
        onExpandedChange={onExpandedChange}
        onParentKeyDown={vi.fn()}
      />,
    );

    expect(screen.getByRole("option", { name: "Tag 4" })).toHaveFocus();
    expect(onExpandedChange).not.toHaveBeenCalled();
  });

  it("restores trigger focus when candidates shrink while external input is focused", async () => {
    const onExpandedChange = vi.fn();
    const { rerender } = render(
      <HookHarness
        availableTagCount={2}
        availableTagIds={["tag-1", "tag-2"]}
        onExpandedChange={onExpandedChange}
        onParentKeyDown={vi.fn()}
      />,
    );
    const externalInput = screen.getByRole("textbox", { name: "External input" });
    await waitFor(() => {
      expect(screen.getByRole("option", { name: "Tag 1" })).toHaveFocus();
    });
    externalInput.focus();

    rerender(
      <HookHarness
        availableTagCount={1}
        availableTagIds={["tag-2"]}
        onExpandedChange={onExpandedChange}
        onParentKeyDown={vi.fn()}
      />,
    );

    expect(onExpandedChange).toHaveBeenCalledWith(false);

    rerender(
      <HookHarness
        availableTagCount={1}
        availableTagIds={["tag-2"]}
        isExpanded={false}
        onExpandedChange={onExpandedChange}
        onParentKeyDown={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Tag picker trigger" })).toHaveFocus();
    });
  });

  it("restores trigger focus when a shrink closes the picker while an external button is focused", async () => {
    const onExpandedChange = vi.fn();
    const { rerender } = render(
      <HookHarness availableTagCount={3} onExpandedChange={onExpandedChange} onParentKeyDown={vi.fn()} />,
    );
    await waitFor(() => {
      expect(screen.getByRole("option", { name: "Tag 1" })).toHaveFocus();
    });
    const externalButton = screen.getByRole("button", { name: "External button" });
    externalButton.focus();

    rerender(<HookHarness availableTagCount={2} onExpandedChange={onExpandedChange} onParentKeyDown={vi.fn()} />);
    expect(onExpandedChange).toHaveBeenCalledWith(false);

    rerender(
      <HookHarness
        availableTagCount={2}
        isExpanded={false}
        onExpandedChange={onExpandedChange}
        onParentKeyDown={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Tag picker trigger" })).toHaveFocus();
    });
  });

  it("restores trigger focus when candidates shrink while the picker input is focused", async () => {
    const onExpandedChange = vi.fn();
    const requestAnimationFrameSpy = vi.spyOn(window, "requestAnimationFrame");
    const { rerender } = render(
      <HookHarness
        availableTagCount={3}
        availableTagIds={["tag-1", "tag-2", "tag-3"]}
        onExpandedChange={onExpandedChange}
        onParentKeyDown={vi.fn()}
      />,
    );
    await waitFor(() => {
      expect(screen.getByRole("option", { name: "Tag 1" })).toHaveFocus();
    });
    requestAnimationFrameSpy.mockClear();
    screen.getByRole("textbox", { name: "Picker input" }).focus();

    rerender(
      <HookHarness
        availableTagCount={2}
        availableTagIds={["tag-1", "tag-2"]}
        onExpandedChange={onExpandedChange}
        onParentKeyDown={vi.fn()}
      />,
    );
    expect(onExpandedChange).toHaveBeenCalledWith(false);

    rerender(
      <HookHarness
        availableTagCount={2}
        availableTagIds={["tag-1", "tag-2"]}
        isExpanded={false}
        onExpandedChange={onExpandedChange}
        onParentKeyDown={vi.fn()}
      />,
    );

    expect(screen.queryByRole("textbox", { name: "Picker input" })).not.toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Tag picker trigger" })).toHaveFocus();
    });
    expect(requestAnimationFrameSpy).toHaveBeenCalled();
  });

  it("does not restore stale candidate focus after an explicit blur to the document body", () => {
    const onExpandedChange = vi.fn();
    const { rerender } = render(
      <HookHarness
        availableTagCount={3}
        availableTagIds={["tag-1", "tag-2", "tag-3"]}
        onExpandedChange={onExpandedChange}
        onParentKeyDown={vi.fn()}
      />,
    );
    const focusedOption = screen.getByRole("option", { name: "Tag 2" });
    focusedOption.focus();
    focusedOption.blur();

    rerender(
      <HookHarness
        availableTagCount={3}
        availableTagIds={["tag-1", "tag-4", "tag-3"]}
        onExpandedChange={onExpandedChange}
        onParentKeyDown={vi.fn()}
      />,
    );

    expect(document.activeElement).toBe(document.body);
    expect(onExpandedChange).not.toHaveBeenCalled();
  });

  it("restores focus to the trigger when the focused candidate leaves no candidates", async () => {
    const onExpandedChange = vi.fn();
    const { rerender } = render(
      <HookHarness
        availableTagCount={1}
        availableTagIds={["tag-1"]}
        onExpandedChange={onExpandedChange}
        onParentKeyDown={vi.fn()}
      />,
    );

    screen.getByRole("option", { name: "Tag 1" }).focus();
    rerender(
      <HookHarness
        availableTagCount={0}
        availableTagIds={[]}
        onExpandedChange={onExpandedChange}
        onParentKeyDown={vi.fn()}
      />,
    );

    expect(onExpandedChange).toHaveBeenCalledWith(false);

    rerender(
      <HookHarness
        availableTagCount={0}
        isExpanded={false}
        onExpandedChange={onExpandedChange}
        onParentKeyDown={vi.fn()}
      />,
    );

    const trigger = screen.getByRole("button", { name: "Tag picker trigger" });
    await waitFor(() => {
      expect(document.activeElement).toBe(trigger);
    });
  });

  it("closes the popover when the available tags shrink while open", () => {
    const onExpandedChange = vi.fn();

    const { rerender } = render(
      <HookHarness availableTagCount={3} onExpandedChange={onExpandedChange} onParentKeyDown={vi.fn()} />,
    );
    expect(onExpandedChange).not.toHaveBeenCalled();

    rerender(<HookHarness availableTagCount={2} onExpandedChange={onExpandedChange} onParentKeyDown={vi.fn()} />);

    expect(onExpandedChange).toHaveBeenCalledWith(false);
  });

  it("returns focus to the trigger after the available tags shrink closes the popover", async () => {
    const onExpandedChange = vi.fn();

    const { rerender } = render(
      <HookHarness availableTagCount={3} onExpandedChange={onExpandedChange} onParentKeyDown={vi.fn()} />,
    );
    rerender(<HookHarness availableTagCount={2} onExpandedChange={onExpandedChange} onParentKeyDown={vi.fn()} />);
    expect(onExpandedChange).toHaveBeenCalledWith(false);

    rerender(
      <HookHarness
        availableTagCount={2}
        isExpanded={false}
        onExpandedChange={onExpandedChange}
        onParentKeyDown={vi.fn()}
      />,
    );

    const trigger = screen.getByRole("button", { name: "Tag picker trigger" });
    await waitFor(() => {
      expect(document.activeElement).toBe(trigger);
    });
  });

  it("keeps the popover open when the available tags grow", () => {
    const onExpandedChange = vi.fn();

    const { rerender } = render(
      <HookHarness availableTagCount={2} onExpandedChange={onExpandedChange} onParentKeyDown={vi.fn()} />,
    );
    rerender(<HookHarness availableTagCount={3} onExpandedChange={onExpandedChange} onParentKeyDown={vi.fn()} />);

    expect(onExpandedChange).not.toHaveBeenCalled();
  });
});
