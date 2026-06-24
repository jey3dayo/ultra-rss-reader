import { Loader2, Plus } from "lucide-react";
import type { KeyboardEventHandler, MutableRefObject, RefObject } from "react";
import { useLayoutEffect, useRef, useState } from "react";
import { Button, Input } from "@/design-system";
import { TagOptionRowButton } from "./article-tag-picker-buttons";
import type { ArticleTagPickerViewProps } from "./article-tag-picker-view";

type ArticleTagPickerPopoverProps = {
  pickerId: string;
  labels: ArticleTagPickerViewProps["labels"];
  availableTags: ArticleTagPickerViewProps["availableTags"];
  newTagName: string;
  newTagError?: string;
  isCreateTagPending: boolean;
  newTagInputRef: RefObject<HTMLInputElement | null>;
  tagOptionRefs: MutableRefObject<Array<HTMLButtonElement | null>>;
  onAssignTag: ArticleTagPickerViewProps["onAssignTag"];
  onNewTagNameChange: ArticleTagPickerViewProps["onNewTagNameChange"];
  onCreateTag: () => void;
  onClosePicker: (restoreFocus?: boolean) => void;
  onListboxKeyDown: KeyboardEventHandler<HTMLDivElement>;
};

export function ArticleTagPickerPopover({
  pickerId,
  labels,
  availableTags,
  newTagName,
  newTagError,
  isCreateTagPending,
  newTagInputRef,
  tagOptionRefs,
  onAssignTag,
  onNewTagNameChange,
  onCreateTag,
  onClosePicker,
  onListboxKeyDown,
}: ArticleTagPickerPopoverProps) {
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const viewportShiftRef = useRef(0);
  const [viewportShift, setViewportShift] = useState(0);
  const canCreateTag = newTagName.trim().length > 0 && !isCreateTagPending;
  const inputErrorId = newTagError ? `${pickerId}-new-tag-error` : undefined;

  const handleCreateTag = () => {
    if (canCreateTag) {
      onCreateTag();
    }
  };

  useLayoutEffect(() => {
    const updateViewportShift = () => {
      const popover = popoverRef.current;
      if (!popover) return;

      const viewportPadding = 8;
      const rect = popover.getBoundingClientRect();
      const baseLeft = rect.left - viewportShiftRef.current;
      const baseRight = rect.right - viewportShiftRef.current;
      let nextShift = 0;

      if (baseRight > window.innerWidth - viewportPadding) {
        nextShift = window.innerWidth - viewportPadding - baseRight;
      }
      if (baseLeft + nextShift < viewportPadding) {
        nextShift += viewportPadding - (baseLeft + nextShift);
      }

      viewportShiftRef.current = nextShift;
      setViewportShift(nextShift);
    };

    updateViewportShift();
    window.addEventListener("resize", updateViewportShift);
    return () => window.removeEventListener("resize", updateViewportShift);
  }, []);

  return (
    <div
      ref={popoverRef}
      data-open
      data-side="bottom"
      className="motion-popup-surface absolute top-full left-0 z-50 mt-2 w-max min-w-[min(220px,calc(100vw-1rem))] max-w-[calc(100vw-1rem)] rounded-lg border border-border/70 bg-surface-2 p-1.5 shadow-elevation-3"
      style={{ marginLeft: viewportShift }}
    >
      <div id={pickerId} role="listbox" aria-label={labels.availableTags} onKeyDown={onListboxKeyDown}>
        {availableTags.map((tag, index) => (
          <TagOptionRowButton
            key={tag.id}
            ref={(element) => {
              tagOptionRefs.current[index] = element;
            }}
            role="option"
            aria-selected="false"
            swatchColor={tag.color}
            onClick={() => {
              onAssignTag(tag.id);
            }}
          >
            {tag.name}
          </TagOptionRowButton>
        ))}
      </div>
      <div className="mt-1 flex min-w-0 flex-col items-stretch gap-2 border-t border-border/70 px-2 pt-2 sm:flex-row sm:items-center">
        <Input
          ref={newTagInputRef}
          name="new-tag"
          type="text"
          value={newTagName}
          onChange={(event) => onNewTagNameChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.stopPropagation();
              handleCreateTag();
            }
            if (event.key === "Escape") {
              event.stopPropagation();
              onClosePicker(true);
            }
          }}
          placeholder={labels.newTagPlaceholder}
          aria-label={labels.newTagInputLabel ?? labels.newTagPlaceholder}
          aria-busy={isCreateTagPending || undefined}
          aria-invalid={newTagError ? true : undefined}
          aria-describedby={inputErrorId}
          className="h-11 flex-1 rounded-md bg-surface-1/70 px-2 text-sm shadow-none focus-visible:ring-2 focus-visible:ring-ring/60"
        />
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={handleCreateTag}
          disabled={!canCreateTag}
          aria-busy={isCreateTagPending || undefined}
          className="size-11 rounded-md text-foreground-soft hover:bg-surface-1/72"
          aria-label={labels.createTag}
        >
          {isCreateTagPending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Plus className="size-4" />
          )}
        </Button>
      </div>
      {newTagError ? (
        <p id={inputErrorId} className="px-2 pt-1.5 text-xs leading-5 text-state-danger-foreground">
          {newTagError}
        </p>
      ) : null}
    </div>
  );
}
