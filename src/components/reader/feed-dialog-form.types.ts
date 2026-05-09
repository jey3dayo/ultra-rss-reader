import type { RefObject } from "react";
import type { CopyableReadonlyFieldItem } from "@/components/shared/copyable-readonly-field-list";
import type { FolderSelectViewProps } from "./folder-select-view";

export type FeedDialogReadonlyFieldProps = CopyableReadonlyFieldItem;

export type FeedDialogSelectOption = {
  value: string;
  label: string;
};

export type FeedDialogControllerFolderSelectProps = {
  folderSelectValue: string;
  folderOptions: FolderSelectViewProps["options"];
  isCreatingFolder: boolean;
  newFolderName: string;
  newFolderInputRef: RefObject<HTMLInputElement | null>;
  handleFolderChange: (value: string) => void;
  setNewFolderName: (value: string) => void;
};

export type FeedDialogFolderSelectionParams = {
  selectedFolderId: string | null;
  isCreatingFolder: boolean;
  newFolderName: string;
};
