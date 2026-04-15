import { Plus } from "lucide-react";
import { useId } from "react";
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
    <section
      aria-label={labels.sectionTitle ?? "Tags"}
      className="rounded-xl border border-border/70 bg-card/32 px-4 py-3"
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/82">
            {labels.sectionTitle ?? "Tags"}
          </h2>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <ArticleTagChipList assignedTags={assignedTags} labels={labels} onRemoveTag={onRemoveTag} />
        <div ref={pickerRef} className="relative" data-disable-global-shortcuts="true">
          <button
            ref={triggerRef}
            type="button"
            onClick={() => onExpandedChange(!isExpanded)}
            onKeyDown={handleTriggerKeyDown}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border/80 bg-background/40 text-muted-foreground transition-colors hover:border-foreground/40 hover:bg-accent/50 hover:text-foreground"
            aria-label={labels.addTag}
            aria-haspopup="listbox"
            aria-expanded={isExpanded}
            aria-controls={pickerId}
          >
            <Plus className="h-3 w-3" />
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
    </section>
  );
}
