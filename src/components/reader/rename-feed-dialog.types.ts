import type { RefObject } from "react";
import type { FeedDto, FolderDto } from "@/api/tauri-commands";
import type { FeedDialogReadonlyFieldProps, FeedDialogSelectOption } from "./feed-dialog-form.types";
import type { FeedEditDisplayPreset } from "./feed-edit-submit";
import type { FolderSelectViewProps } from "./folder-select-view";

export type RenameFeedDialogViewLabels = {
  title: string;
  titleField: string;
  displayMode: string;
  cancel: string;
  save: string;
  saving: string;
};

export type RenameFeedDialogViewOption = FeedDialogSelectOption;
export type RenameFeedDialogViewUrlField = Omit<FeedDialogReadonlyFieldProps, "name">;

export type RenameFeedDialogViewProps = {
  open: boolean;
  title: string;
  loading: boolean;
  displayMode: string;
  displayModeOptions: RenameFeedDialogViewOption[];
  urlFields: RenameFeedDialogViewUrlField[];
  onOpenChange: (open: boolean) => void;
  onTitleChange: (value: string) => void;
  onDisplayModeChange: (value: string) => void;
  folderSelectProps?: FolderSelectViewProps;
  labels: RenameFeedDialogViewLabels;
  inputRef?: RefObject<HTMLInputElement | null>;
  onSubmit: () => void;
};

export type RenameFeedDialogControllerParams = {
  feed: FeedDto;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export type RenameFeedDialogControllerFolderSelectProps = {
  folderSelectValue: string;
  folderOptions: FolderDto extends never ? never : FolderSelectViewProps["options"];
  isCreatingFolder: boolean;
  newFolderName: string;
  newFolderInputRef: RefObject<HTMLInputElement | null>;
  handleFolderChange: (value: string) => void;
  setNewFolderName: (value: string) => void;
};

export type RenameFeedDialogController = {
  title: string;
  loading: boolean;
  displayPreset: FeedEditDisplayPreset;
  inputRef: RefObject<HTMLInputElement | null>;
  folders: FolderDto[] | undefined;
  setTitle: (value: string) => void;
  setDisplayPreset: (value: FeedEditDisplayPreset) => void;
  handleCopy: (value: string) => Promise<void>;
  handleSubmit: () => Promise<void>;
  folderSelectProps: RenameFeedDialogControllerFolderSelectProps;
};
