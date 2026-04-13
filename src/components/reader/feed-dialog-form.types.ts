import type { RefObject } from "react";
import type { CopyableReadonlyFieldItem } from "@/components/shared/copyable-readonly-field-list";
import type { FeedDialogUrlSectionProps } from "./feed-dialog-url-section";
import type { FolderSelectViewProps } from "./folder-select-view";

export type FeedDialogFormUrlSectionProps = Omit<FeedDialogUrlSectionProps, "helperTextId" | "inputId">;

export type FeedDialogFormLabels = {
  title: string;
  description?: string;
  cancel: string;
  submit: string;
  submitting: string;
};

export type FeedDialogTextSectionProps = {
  label: string;
  name: string;
  value: string;
  onValueChange: (value: string) => void;
  disabled: boolean;
  inputRef?: RefObject<HTMLInputElement | null>;
};

export type FeedDialogReadonlyFieldProps = CopyableReadonlyFieldItem;

export type FeedDialogSelectOption = {
  value: string;
  label: string;
};

export type FeedDialogSelectSectionProps = {
  label: string;
  name: string;
  value: string;
  options: FeedDialogSelectOption[];
  disabled: boolean;
  onValueChange: (value: string) => void;
};

export type FeedDialogFormViewProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loading: boolean;
  isSubmitDisabled: boolean;
  labels: FeedDialogFormLabels;
  urlSection?: FeedDialogFormUrlSectionProps;
  textSection?: FeedDialogTextSectionProps;
  readonlyFields?: FeedDialogReadonlyFieldProps[];
  selectSection?: FeedDialogSelectSectionProps;
  folderSelectProps?: FolderSelectViewProps;
  error?: string | null;
  successMessage?: string | null;
  onSubmit: () => void;
};
