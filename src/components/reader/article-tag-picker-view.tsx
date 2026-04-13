import { Plus } from "lucide-react";
import { useId } from "react";
import { ArticleTagChipList } from "./article-tag-chip-list";
import { ArticleTagPickerPopover } from "./article-tag-picker-popover";
import { useArticleTagPickerPopover } from "./use-article-tag-picker-popover";

export type ArticleTagPickerViewLabels = {
  sectionTitle?: string;
  sectionHint?: string;
  addTag: string;
  availableTags: string;
  newTagPlaceholder: string;
  createTag: string;
  removeTag: (name: string) => string;
};

export type ArticleTagPickerTagView = {
  id: string;
  name: string;
  color: string | null;
};

export type ArticleTagPickerViewProps = {
  assignedTags: ArticleTagPickerTagView[];
  availableTags: ArticleTagPickerTagView[];
  newTagName: string;
  isExpanded: boolean;
  labels: ArticleTagPickerViewLabels;
  onExpandedChange: (expanded: boolean) => void;
  onNewTagNameChange: (value: string) => void;
  onAssignTag: (tagId: string) => void;
  onRemoveTag: (tagId: string) => void;
  onCreateTag: (name: string) => void;
};

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
      className="rounded-2xl border border-border/70 bg-card/40 px-3 py-2.5"
    >
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {labels.sectionTitle ?? "Tags"}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">{labels.sectionHint ?? "Add and organize article tags"}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <ArticleTagChipList assignedTags={assignedTags} labels={labels} onRemoveTag={onRemoveTag} />
        <div ref={pickerRef} className="relative" data-disable-global-shortcuts="true">
          <button
            ref={triggerRef}
            type="button"
            onClick={() => onExpandedChange(!isExpanded)}
            onKeyDown={handleTriggerKeyDown}
            className="inline-flex h-8 min-w-8 items-center justify-center rounded-full border border-dashed border-muted-foreground px-2 text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
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
