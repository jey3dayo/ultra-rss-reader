import { Plus } from "lucide-react";
import type { KeyboardEventHandler, MutableRefObject, RefObject } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ArticleTagPickerViewProps } from "./article-tag-picker.types";
import { TagOptionRowButton } from "./article-tag-picker-buttons";

type ArticleTagPickerPopoverProps = {
  pickerId: string;
  labels: ArticleTagPickerViewProps["labels"];
  availableTags: ArticleTagPickerViewProps["availableTags"];
  newTagName: string;
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
  newTagInputRef,
  tagOptionRefs,
  onAssignTag,
  onNewTagNameChange,
  onCreateTag,
  onClosePicker,
  onListboxKeyDown,
}: ArticleTagPickerPopoverProps) {
  return (
    <div
      id={pickerId}
      role="listbox"
      aria-label={labels.availableTags}
      data-open
      data-side="bottom"
      className="motion-popup-surface absolute top-full left-0 z-50 mt-2 min-w-[220px] rounded-lg border border-border/70 bg-surface-2 p-1.5 shadow-elevation-3"
      onKeyDown={onListboxKeyDown}
    >
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
      <div className="mt-1 flex items-center gap-1.5 border-t border-border/70 px-2 pt-2">
        <Input
          ref={newTagInputRef}
          name="new-tag"
          type="text"
          value={newTagName}
          onChange={(event) => onNewTagNameChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.stopPropagation();
              onCreateTag();
            }
            if (event.key === "Escape") {
              event.stopPropagation();
              onClosePicker(true);
            }
          }}
          placeholder={labels.newTagPlaceholder}
          className="h-10 flex-1 rounded-md border-none bg-transparent px-1 text-sm shadow-none ring-0 focus-visible:ring-0"
        />
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onCreateTag}
          disabled={!newTagName.trim()}
          className="size-10 rounded-md text-foreground-soft hover:bg-surface-1/72"
          aria-label={labels.createTag}
        >
          <Plus className="size-3" />
        </Button>
      </div>
    </div>
  );
}
