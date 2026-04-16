import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ArticleTagPickerPopoverProps } from "./article-tag-picker.types";

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
      className="absolute top-full left-0 z-50 mt-2 min-w-[220px] rounded-lg border border-border/80 bg-popover/98 p-1.5 shadow-lg"
      onKeyDown={onListboxKeyDown}
    >
      {availableTags.map((tag, index) => (
        <button
          type="button"
          key={tag.id}
          ref={(element) => {
            tagOptionRefs.current[index] = element;
          }}
          role="option"
          aria-selected="false"
          onClick={() => {
            onAssignTag(tag.id);
            onExpandedChange(false);
          }}
          className="flex min-h-11 w-full items-center gap-2 rounded-md px-3 py-2.5 text-left text-sm text-popover-foreground hover:bg-accent/80"
        >
          {tag.color && (
            <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: tag.color }} />
          )}
          {tag.name}
        </button>
      ))}
      <div className="mt-1 flex items-center gap-1.5 border-t border-border/80 px-2 pt-2">
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
          className="h-10 w-10 rounded-md text-muted-foreground hover:bg-accent/80"
          aria-label={labels.createTag}
        >
          <Plus className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
