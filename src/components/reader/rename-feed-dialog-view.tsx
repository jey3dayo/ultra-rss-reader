import type { RefObject } from "react";
import { CopyableReadonlyFieldList } from "@/components/shared/copyable-readonly-field-list";
import { FormDialogShell } from "@/components/shared/form-dialog-shell";
import { StackedInputField } from "@/components/shared/stacked-input-field";
import { StackedSelectField } from "@/components/shared/stacked-select-field";
import { MOTION_CONTENT_SWAP_CLASS_NAME } from "@/constants/motion";
import type { FeedDialogReadonlyFieldProps, FeedDialogSelectOption } from "./feed-dialog-form.types";
import { FolderSelectView, type FolderSelectViewProps } from "./folder-select-view";

type RenameFeedDialogViewLabels = {
  title: string;
  titleField: string;
  displayMode: string;
  cancel: string;
  save: string;
  saving: string;
};

type RenameFeedDialogViewUrlField = Omit<FeedDialogReadonlyFieldProps, "name">;

type RenameFeedDialogViewProps = {
  open: boolean;
  title: string;
  loading: boolean;
  displayMode: string;
  displayModeOptions: FeedDialogSelectOption[];
  urlFields: RenameFeedDialogViewUrlField[];
  onOpenChange: (open: boolean) => void;
  onTitleChange: (value: string) => void;
  onDisplayModeChange: (value: string) => void;
  folderSelectProps?: FolderSelectViewProps;
  labels: RenameFeedDialogViewLabels;
  inputRef?: RefObject<HTMLInputElement | null>;
  onSubmit: () => void;
};

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
  const submitDisabled = !title.trim() || loading;

  return (
    <FormDialogShell
      open={open}
      title={labels.title}
      cancelLabel={labels.cancel}
      submitLabel={labels.save}
      submittingLabel={labels.saving}
      loading={loading}
      submitDisabled={submitDisabled}
      cancelDisabled={loading}
      size="wide"
      bodyClassName="space-y-5 py-5"
      onOpenChange={onOpenChange}
      onSubmit={onSubmit}
    >
      <StackedInputField
        label={labels.titleField}
        inputRef={inputRef}
        name="feed-title"
        type="text"
        value={title}
        onChange={onTitleChange}
        inputClassName="mt-1"
        disabled={loading}
      />

      <CopyableReadonlyFieldList
        className="space-y-5"
        fields={urlFields.map((field) => ({
          ...field,
          name: field.key,
        }))}
      />

      <StackedSelectField
        label={labels.displayMode}
        name="feed-display-mode"
        value={displayMode}
        options={displayModeOptions}
        onChange={onDisplayModeChange}
        disabled={loading}
        triggerClassName="mt-1 w-full"
      />

      {folderSelectProps ? (
        <div
          data-testid="feed-dialog-folder-section"
          data-motion-phase="entering"
          className={`${MOTION_CONTENT_SWAP_CLASS_NAME} rounded-md border border-border/70 bg-surface-1/80 px-4 py-4`}
        >
          <FolderSelectView {...folderSelectProps} />
        </div>
      ) : null}
    </FormDialogShell>
  );
}
