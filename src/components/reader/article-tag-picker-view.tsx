import { Plus, X } from "lucide-react";
import { useId } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
        {assignedTags.map((tag) => (
          <span
            key={tag.id}
            className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground"
          >
            {tag.color && (
              <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: tag.color }} />
            )}
            {tag.name}
            <button
              type="button"
              onClick={() => onRemoveTag(tag.id)}
              className="ml-0.5 inline-flex size-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label={labels.removeTag(tag.name)}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
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
            <div
              id={pickerId}
              role="listbox"
              aria-label={labels.availableTags}
              className="absolute top-full left-0 z-50 mt-1 min-w-[180px] rounded-lg border border-border bg-popover p-1 shadow-lg"
              onKeyDown={handleListboxKeyDown}
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
                    <span
                      className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: tag.color }}
                    />
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
                      handleCreateTag();
                    }
                    if (event.key === "Escape") {
                      event.stopPropagation();
                      closePicker(true);
                    }
                  }}
                  placeholder={labels.newTagPlaceholder}
                  className="h-auto flex-1 rounded border-none bg-transparent px-1 py-1 text-xs shadow-none ring-0 focus-visible:ring-0"
                />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={handleCreateTag}
                  disabled={!newTagName.trim()}
                  className="h-5 w-5 text-muted-foreground"
                  aria-label={labels.createTag}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
