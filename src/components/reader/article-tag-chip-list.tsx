import { TagChip } from "@/components/shared/tag-chip";
import type { ArticleTagPickerViewProps } from "./article-tag-picker.types";

type ArticleTagChipListProps = {
  assignedTags: ArticleTagPickerViewProps["assignedTags"];
  labels: ArticleTagPickerViewProps["labels"];
  onRemoveTag: ArticleTagPickerViewProps["onRemoveTag"];
};

export function ArticleTagChipList({ assignedTags, labels, onRemoveTag }: ArticleTagChipListProps) {
  return assignedTags.map((tag) => (
    <TagChip
      key={tag.id}
      label={tag.name}
      color={tag.color}
      onRemove={() => onRemoveTag(tag.id)}
      removeLabel={labels.removeTag(tag.name)}
      className="bg-background/10"
    />
  ));
}
