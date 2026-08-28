import { useRef } from "react";
import { TagChip } from "@/design-system";
import { cn } from "@/lib/utils";
import type { ArticleTagPickerViewProps } from "./article-tag-picker-view";

type ArticleTagChipListProps = {
  assignedTags: ArticleTagPickerViewProps["assignedTags"];
  labels: ArticleTagPickerViewProps["labels"];
  onRemoveTag: ArticleTagPickerViewProps["onRemoveTag"];
};

export function ArticleTagChipList({ assignedTags, labels, onRemoveTag }: ArticleTagChipListProps) {
  const initialAssignedTagIds = useRef(new Set(assignedTags.map((tag) => tag.id))).current;

  return assignedTags.map((tag) => (
    <TagChip
      key={tag.id}
      label={tag.name}
      color={tag.color}
      onRemove={() => onRemoveTag(tag.id)}
      removeLabel={labels.removeTag(tag.name)}
      className={cn(!initialAssignedTagIds.has(tag.id) && "motion-list-item-enter", "bg-background/10")}
    />
  ));
}
