import type { KeyboardEventHandler, MutableRefObject, RefObject } from "react";

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

export type ArticleTagChipListProps = {
  assignedTags: ArticleTagPickerViewProps["assignedTags"];
  labels: ArticleTagPickerViewProps["labels"];
  onRemoveTag: ArticleTagPickerViewProps["onRemoveTag"];
};

export type ArticleTagPickerPopoverProps = {
  pickerId: string;
  labels: ArticleTagPickerViewProps["labels"];
  availableTags: ArticleTagPickerViewProps["availableTags"];
  newTagName: string;
  newTagInputRef: RefObject<HTMLInputElement | null>;
  tagOptionRefs: MutableRefObject<Array<HTMLButtonElement | null>>;
  onExpandedChange: ArticleTagPickerViewProps["onExpandedChange"];
  onAssignTag: ArticleTagPickerViewProps["onAssignTag"];
  onNewTagNameChange: ArticleTagPickerViewProps["onNewTagNameChange"];
  onCreateTag: () => void;
  onClosePicker: (restoreFocus?: boolean) => void;
  onListboxKeyDown: KeyboardEventHandler<HTMLDivElement>;
};

export type UseArticleTagPickerPopoverParams = {
  isExpanded: boolean;
  availableTagCount: number;
  onExpandedChange: ArticleTagPickerViewProps["onExpandedChange"];
};
