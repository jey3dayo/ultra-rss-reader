import { Plus } from "lucide-react";
import { useId } from "react";
import { useArticleTagPickerPopover } from "@/components/reader/hooks/article/use-article-tag-picker-popover";
import type { TagViewItem } from "@/lib/tags.types";
import { ArticleTagChipList } from "./article-tag-chip-list";
import { TagPickerTriggerButton } from "./article-tag-picker-buttons";
import { ArticleTagPickerPopover } from "./article-tag-picker-popover";

type ArticleTagPickerViewLabels = Readonly<{
  sectionTitle?: string;
  sectionHint?: string;
  addTag: string;
  availableTags: string;
  newTagPlaceholder: string;
  createTag: string;
  removeTag: (name: string) => string;
}>;

export type ArticleTagPickerTagView = Readonly<Pick<TagViewItem, "id" | "name" | "color">>;

export type ArticleTagPickerViewProps = Readonly<{
  assignedTags: readonly ArticleTagPickerTagView[];
  availableTags: readonly ArticleTagPickerTagView[];
  newTagName: string;
  isExpanded: boolean;
  isCreateTagPending?: boolean;
  labels: ArticleTagPickerViewLabels;
  onExpandedChange: (expanded: boolean) => void;
  onNewTagNameChange: (value: string) => void;
  onAssignTag: (tagId: string) => void;
  onRemoveTag: (tagId: string) => void;
  onCreateTag: (name: string) => void;
}>;

export function ArticleTagPickerView({
  assignedTags,
  availableTags,
  newTagName,
  isExpanded,
  isCreateTagPending = false,
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
    requestFocusRestoreOnClose,
    handleTriggerKeyDown,
    handleListboxKeyDown,
  } = useArticleTagPickerPopover({
    isExpanded,
    availableTagCount: availableTags.length,
    onExpandedChange,
    onNewTagNameChange,
  });

  const handleCreateTag = () => {
    if (isCreateTagPending) return;
    const trimmedName = newTagName.trim();
    if (!trimmedName) return;
    requestFocusRestoreOnClose();
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
              <Plus className="size-3" aria-hidden="true" />
              {hasAssignedTags ? null : <span className="truncate">{labels.addTag}</span>}
            </TagPickerTriggerButton>
            {isExpanded && (
              <ArticleTagPickerPopover
                pickerId={pickerId}
                labels={labels}
                availableTags={availableTags}
                newTagName={newTagName}
                isCreateTagPending={isCreateTagPending}
                newTagInputRef={newTagInputRef}
                tagOptionRefs={tagOptionRefs}
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
