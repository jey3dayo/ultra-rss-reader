import { X } from "lucide-react";
import type { ArticleTagChipListProps } from "./article-tag-picker.types";

export function ArticleTagChipList({ assignedTags, labels, onRemoveTag }: ArticleTagChipListProps) {
  return assignedTags.map((tag) => (
    <span
      key={tag.id}
      className="inline-flex items-center gap-2 rounded-lg border border-border/80 bg-background/55 px-2.5 py-1.5 text-xs font-medium text-foreground/88"
    >
      {tag.color && (
        <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: tag.color }} />
      )}
      {tag.name}
      <button
        type="button"
        onClick={() => onRemoveTag(tag.id)}
        className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
        aria-label={labels.removeTag(tag.name)}
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  ));
}
