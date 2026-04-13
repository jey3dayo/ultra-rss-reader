import type { RefObject } from "react";
import type { FeedDialogReadonlyFieldProps, FeedDialogSelectOption } from "./feed-dialog-form.types";
import { FeedDialogFormView } from "./feed-dialog-form-view";
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

export function RenameFeedDialogView({
  open,
  title,
  loading,
  displayMode,
  displayModeOptions,
  urlFields,
  onOpenChange,
  onTitleChange,
  onDisplayModeChange,
  folderSelectProps,
  labels,
  inputRef,
  onSubmit,
}: {
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
}) {
  return (
    <FeedDialogFormView
      open={open}
      onOpenChange={onOpenChange}
      loading={loading}
      isSubmitDisabled={!title.trim() || loading}
      labels={{
        title: labels.title,
        cancel: labels.cancel,
        submit: labels.save,
        submitting: labels.saving,
      }}
      textSection={{
        label: labels.titleField,
        name: "feed-title",
        value: title,
        onValueChange: onTitleChange,
        disabled: loading,
        inputRef,
      }}
      readonlyFields={urlFields.map((field) => ({
        ...field,
        name: field.key,
      }))}
      selectSection={{
        label: labels.displayMode,
        name: "feed-display-mode",
        value: displayMode,
        options: displayModeOptions,
        disabled: loading,
        onValueChange: onDisplayModeChange,
      }}
      folderSelectProps={folderSelectProps}
      onSubmit={onSubmit}
    />
  );
}
