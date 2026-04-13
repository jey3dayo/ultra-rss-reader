import { FeedDialogFormView } from "./feed-dialog-form-view";
import type { RenameFeedDialogViewProps } from "./rename-feed-dialog.types";

export type {
  RenameFeedDialogViewLabels,
  RenameFeedDialogViewOption,
  RenameFeedDialogViewProps,
  RenameFeedDialogViewUrlField,
} from "./rename-feed-dialog.types";

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
}: RenameFeedDialogViewProps) {
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
