import { Plus } from "lucide-react";
import { useId } from "react";
import { cn } from "@/lib/utils";
import { ArticleTagChipList } from "./article-tag-chip-list";
import type { ArticleTagPickerViewProps } from "./article-tag-picker.types";
import { ArticleTagPickerPopover } from "./article-tag-picker-popover";
import { useArticleTagPickerPopover } from "./use-article-tag-picker-popover";

export function ArticleTagPickerView({
  assignedTags,
  availableTags,
  newTagName,
  isExpanded,
  labels,
  onExpandedChange,
  onNewTagNameChange,
  onAssignTag,
  onRemoveTag,
  onCreateTag,
}: ArticleTagPickerViewProps) {
  const hasAssignedTags = assignedTags.length > 0;
  const pickerId = useId();
  const {
    pickerRef,
    triggerRef,
    newTagInputRef,
    tagOptionRefs,
    closePicker,
    handleTriggerKeyDown,
    handleListboxKeyDown,
  } = useArticleTagPickerPopover({
    isExpanded,
    availableTagCount: availableTags.length,
    onExpandedChange,
  });

  const handleCreateTag = () => {
    const trimmedName = newTagName.trim();
    if (!trimmedName) return;
    onCreateTag(trimmedName);
  };

  const addTagTriggerClassName = cn(
    "inline-flex min-h-6 items-center justify-center rounded-full border text-[12px] leading-none text-foreground-soft transition-[color,background-color,border-color,box-shadow] select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/45",
    hasAssignedTags ? "gap-0 px-2" : "gap-1.5 px-2.5 pr-3",
    isExpanded
      ? "border-border/60 bg-surface-2/88 text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
      : "border-border/45 bg-background/12 hover:border-border/60 hover:bg-surface-1/72 hover:text-foreground focus-visible:border-border/60 focus-visible:bg-surface-1/72 focus-visible:text-foreground",
  );

  return (
    <section aria-label={labels.sectionTitle ?? "Tags"} className="inline-block max-w-full py-1">
      <div className="flex max-w-full items-center gap-2">
        {hasAssignedTags ? null : (
          <h2 className="shrink-0 text-[0.72rem] font-medium leading-5 tracking-[0.14em] text-foreground-soft uppercase">
            {labels.sectionTitle ?? "Tags"}
          </h2>
        )}
        <div
          className={`flex min-w-0 flex-wrap items-center ${hasAssignedTags ? "gap-x-2 gap-y-1.5" : "gap-x-1.5 gap-y-1.5"}`}
        >
          <ArticleTagChipList assignedTags={assignedTags} labels={labels} onRemoveTag={onRemoveTag} />
          <div ref={pickerRef} className="relative" data-disable-global-shortcuts="true">
            <button
              ref={triggerRef}
              type="button"
              onClick={() => onExpandedChange(!isExpanded)}
              onKeyDown={handleTriggerKeyDown}
              className={addTagTriggerClassName}
              aria-label={labels.addTag}
              aria-haspopup="listbox"
              aria-expanded={isExpanded}
              aria-controls={pickerId}
            >
              <Plus className="h-3 w-3" aria-hidden="true" />
              {hasAssignedTags ? null : <span className="truncate">{labels.addTag}</span>}
            </button>
            {isExpanded && (
              <ArticleTagPickerPopover
                pickerId={pickerId}
                labels={labels}
                availableTags={availableTags}
                newTagName={newTagName}
                newTagInputRef={newTagInputRef}
                tagOptionRefs={tagOptionRefs}
                onExpandedChange={onExpandedChange}
                onAssignTag={onAssignTag}
                onNewTagNameChange={onNewTagNameChange}
                onCreateTag={handleCreateTag}
                onClosePicker={closePicker}
                onListboxKeyDown={handleListboxKeyDown}
              />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
