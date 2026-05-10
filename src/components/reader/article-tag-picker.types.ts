import type { TagViewItem } from "@/lib/tags.types";

type ArticleTagPickerViewLabels = {
  sectionTitle?: string;
  sectionHint?: string;
  addTag: string;
  availableTags: string;
  newTagPlaceholder: string;
  createTag: string;
  removeTag: (name: string) => string;
};

export type ArticleTagPickerTagView = TagViewItem;

export type ArticleTagPickerViewProps = {
  assignedTags: ArticleTagPickerTagView[];
  availableTags: ArticleTagPickerTagView[];
  newTagName: string;
  isExpanded: boolean;
  isCreateTagPending?: boolean;
  labels: ArticleTagPickerViewLabels;
  onExpandedChange: (expanded: boolean) => void;
  onNewTagNameChange: (value: string) => void;
  onAssignTag: (tagId: string) => void;
  onRemoveTag: (tagId: string) => void;
  onCreateTag: (name: string) => void;
};
