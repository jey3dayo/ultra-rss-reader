import { Plus } from "lucide-react";
import type { KeyboardEventHandler, MutableRefObject, RefObject } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ArticleTagPickerTagView, ArticleTagPickerViewLabels } from "./article-tag-picker-view";

type ArticleTagPickerPopoverProps = {
  pickerId: string;
  labels: ArticleTagPickerViewLabels;
  availableTags: ArticleTagPickerTagView[];
  newTagName: string;
  newTagInputRef: RefObject<HTMLInputElement | null>;
  tagOptionRefs: MutableRefObject<Array<HTMLButtonElement | null>>;
  onExpandedChange: (expanded: boolean) => void;
  onAssignTag: (tagId: string) => void;
  onNewTagNameChange: (value: string) => void;
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
      className="absolute top-full left-0 z-50 mt-1 min-w-[180px] rounded-lg border border-border bg-popover p-1 shadow-lg"
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
          className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-left text-sm text-popover-foreground hover:bg-accent"
        >
          {tag.color && (
            <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: tag.color }} />
          )}
          {tag.name}
        </button>
      ))}
      <div className="flex items-center gap-1 border-t border-border px-2 pt-1">
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
          className="h-auto flex-1 rounded border-none bg-transparent px-1 py-1 text-xs shadow-none ring-0 focus-visible:ring-0"
        />
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onCreateTag}
          disabled={!newTagName.trim()}
          className="h-5 w-5 text-muted-foreground"
          aria-label={labels.createTag}
        >
          <Plus className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
