import { X } from "lucide-react";
import type { ArticleTagChipListProps } from "./article-tag-picker.types";

export function ArticleTagChipList({ assignedTags, labels, onRemoveTag }: ArticleTagChipListProps) {
  return assignedTags.map((tag) => (
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
  ));
}
