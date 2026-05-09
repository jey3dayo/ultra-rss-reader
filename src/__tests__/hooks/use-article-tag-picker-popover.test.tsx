import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useArticleTagPickerPopover } from "@/components/reader/hooks/article/use-article-tag-picker-popover";

type HookHarnessProps = {
  availableTagCount: number;
  onExpandedChange: (expanded: boolean) => void;
  onParentKeyDown: () => void;
};

function HookHarness({ availableTagCount, onExpandedChange, onParentKeyDown }: HookHarnessProps) {
  const tags = Array.from({ length: availableTagCount }, (_, index) => ({
    id: `tag-${index + 1}`,
    name: `Tag ${index + 1}`,
  }));
  const { pickerRef, tagOptionRefs, handleListboxKeyDown } = useArticleTagPickerPopover({
    isExpanded: true,
    availableTagCount,
    onExpandedChange,
    onNewTagNameChange: vi.fn(),
  });

  return (
    <div ref={pickerRef} onKeyDown={onParentKeyDown}>
      <span>Tag picker harness</span>
      <div role="listbox" aria-label="Available tags" onKeyDown={handleListboxKeyDown}>
        {tags.map((tag, index) => (
          <button
            key={tag.id}
            ref={(element) => {
              tagOptionRefs.current[index] = element;
            }}
            type="button"
            role="option"
            aria-selected="false"
          >
            {tag.name}
          </button>
        ))}
      </div>
    </div>
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
});
