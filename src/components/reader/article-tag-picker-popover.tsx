import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ArticleTagPickerPopoverProps } from "./article-tag-picker.types";
import { TagOptionRowButton } from "./article-tag-picker-buttons";

export function ArticleTagPickerPopover({
  pickerId,
  labels,
  availableTags,
  newTagName,
  newTagInputRef,
  tagOptionRefs,
  onExpandedChange,
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
            onExpandedChange(false);
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
          className="h-10 w-10 rounded-md text-foreground-soft hover:bg-surface-1/72"
          aria-label={labels.createTag}
        >
          <Plus className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
