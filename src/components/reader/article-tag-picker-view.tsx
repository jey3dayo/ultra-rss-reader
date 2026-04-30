import { Plus } from "lucide-react";
import { useId } from "react";
import { ArticleTagChipList } from "./article-tag-chip-list";
import type { ArticleTagPickerViewProps } from "./article-tag-picker.types";
import { TagPickerTriggerButton } from "./article-tag-picker-buttons";
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
            <TagPickerTriggerButton
              ref={triggerRef}
              compact={hasAssignedTags}
              expanded={isExpanded}
              onClick={() => onExpandedChange(!isExpanded)}
              onKeyDown={handleTriggerKeyDown}
              aria-label={labels.addTag}
              aria-haspopup="listbox"
              aria-expanded={isExpanded}
              aria-controls={pickerId}
            >
              <Plus className="h-3 w-3" aria-hidden="true" />
              {hasAssignedTags ? null : <span className="truncate">{labels.addTag}</span>}
            </TagPickerTriggerButton>
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
