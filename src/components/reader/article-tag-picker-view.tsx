import { Plus, X } from "lucide-react";
import { useCallback, useEffect, useId, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type ArticleTagPickerViewLabels = {
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
  const pickerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const newTagInputRef = useRef<HTMLInputElement>(null);
  const tagOptionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const restoreFocusOnCloseRef = useRef(false);
  const hasFocusedOnOpenRef = useRef(false);

  const closePicker = useCallback(
    (restoreFocus = false) => {
      restoreFocusOnCloseRef.current = restoreFocus;
      onExpandedChange(false);
    },
    [onExpandedChange],
  );

  useEffect(() => {
    if (isExpanded) return;
    if (!restoreFocusOnCloseRef.current) return;

    restoreFocusOnCloseRef.current = false;
    requestAnimationFrame(() => triggerRef.current?.focus());
  }, [isExpanded]);

  useEffect(() => {
    if (!isExpanded) return;

    const handleMouseDown = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        closePicker();
      }
    };

    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [isExpanded, closePicker]);

  useEffect(() => {
    if (!isExpanded || hasFocusedOnOpenRef.current) return;

    hasFocusedOnOpenRef.current = true;

    requestAnimationFrame(() => {
      if (availableTags.length > 0) {
        tagOptionRefs.current[0]?.focus();
        return;
      }
      newTagInputRef.current?.focus();
    });
  }, [isExpanded, availableTags.length]);

  useEffect(() => {
    if (!isExpanded) {
      hasFocusedOnOpenRef.current = false;
    }
  }, [isExpanded]);

  const handleCreateTag = () => {
    const trimmedName = newTagName.trim();
    if (!trimmedName) return;
    onCreateTag(trimmedName);
  };

  return (
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
      <div ref={pickerRef} className="relative">
        <button
          ref={triggerRef}
          type="button"
          onClick={() => onExpandedChange(!isExpanded)}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" && !isExpanded) {
              event.preventDefault();
              event.stopPropagation();
              onExpandedChange(true);
            }
            if (event.key === "Escape" && isExpanded) {
              event.preventDefault();
              event.stopPropagation();
              closePicker(true);
            }
          }}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-dashed border-muted-foreground text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
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
            onKeyDown={(event) => {
              const currentIndex = tagOptionRefs.current.indexOf(document.activeElement as HTMLButtonElement);

              if (event.key === "Escape") {
                event.preventDefault();
                event.stopPropagation();
                closePicker(true);
              }
              if (event.key === "ArrowDown" && availableTags.length > 0) {
                event.preventDefault();
                event.stopPropagation();
                const nextIndex = currentIndex >= 0 ? currentIndex + 1 : 0;
                tagOptionRefs.current[nextIndex % availableTags.length]?.focus();
              }
              if (event.key === "ArrowUp" && availableTags.length > 0) {
                event.preventDefault();
                event.stopPropagation();
                const nextIndex = currentIndex >= 0 ? currentIndex - 1 : availableTags.length - 1;
                tagOptionRefs.current[(nextIndex + availableTags.length) % availableTags.length]?.focus();
              }
            }}
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
  );
}
