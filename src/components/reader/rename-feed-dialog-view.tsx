import { Copy } from "lucide-react";
import type { RefObject } from "react";
import { MOTION_CONTENT_SWAP_CLASS_NAME } from "@/constants/motion";
import {
  AppTooltip,
  Button,
  FormDialogShell,
  LabeledControlRow,
  LabeledInputRow,
  LabeledSelectRow,
} from "@/design-system";
import type { FeedDialogSelectOption } from "./feed-dialog-form.types";
import { FolderSelectView, type FolderSelectViewProps } from "./folder-select-view";
import type { RenameFeedDialogUrlField } from "./rename-feed-dialog.types";

type RenameFeedDialogViewLabels = {
  title: string;
  titleField: string;
  displayMode: string;
  cancel: string;
  save: string;
  saving: string;
};

type RenameFeedDialogViewProps = {
  open: boolean;
  title: string;
  loading: boolean;
  displayMode: string;
  displayModeOptions: FeedDialogSelectOption[];
  urlFields: RenameFeedDialogUrlField[];
  onOpenChange: (open: boolean) => void;
  onTitleChange: (value: string) => void;
  onDisplayModeChange: (value: string) => void;
  folderSelectProps?: FolderSelectViewProps;
  labels: RenameFeedDialogViewLabels;
  inputRef?: RefObject<HTMLInputElement | null>;
  onSubmit: () => void;
};

const FEED_EDIT_ROW_CLASS_NAME =
  "min-h-[52px] border-b-0 py-2.5 sm:grid-cols-[minmax(8.5rem,12rem)_minmax(0,1fr)] sm:items-center sm:gap-x-8";
const FEED_EDIT_CONTROL_CLASS_NAME = "sm:max-w-[20rem]";
const FEED_EDIT_INPUT_CLASS_NAME = "min-h-11 bg-surface-1/78 shadow-none";
const FEED_EDIT_SELECT_CLASS_NAME = "min-h-11 w-full bg-surface-1/78 shadow-none sm:w-[20rem]";

function ReadonlyUrlRow({ field, loading }: { field: RenameFeedDialogUrlField; loading: boolean }) {
  const canCopy = field.value.trim().length > 0;

  return (
    <LabeledControlRow label={field.label} className={FEED_EDIT_ROW_CLASS_NAME}>
      <div className="flex min-w-0 items-center justify-end gap-2 sm:w-[20rem]">
        <span className="min-w-0 flex-1 truncate text-right font-sans text-sm leading-6 text-foreground">
          {field.value}
        </span>
        {field.copyLabel && field.onCopy ? (
          <AppTooltip label={field.copyLabel}>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={field.onCopy}
              disabled={loading || !canCopy}
              aria-label={field.copyLabel}
              className="size-9 shrink-0 border-transparent bg-transparent text-foreground-soft shadow-none hover:text-foreground"
            >
              <Copy className="size-3.5" aria-hidden="true" />
            </Button>
          </AppTooltip>
        ) : null}
      </div>
    </LabeledControlRow>
  );
}

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
      bodyClassName="py-5"
      onOpenChange={onOpenChange}
      onSubmit={onSubmit}
    >
      <LabeledInputRow
        label={labels.titleField}
        inputRef={inputRef}
        name="feed-title"
        type="text"
        value={title}
        onChange={onTitleChange}
        rowClassName={FEED_EDIT_ROW_CLASS_NAME}
        controlClassName={FEED_EDIT_CONTROL_CLASS_NAME}
        inputClassName={FEED_EDIT_INPUT_CLASS_NAME}
        disabled={loading}
      />

      {urlFields.map((field) => (
        <ReadonlyUrlRow key={field.key} field={field} loading={loading} />
      ))}

      <LabeledSelectRow
        label={labels.displayMode}
        name="feed-display-mode"
        value={displayMode}
        options={displayModeOptions}
        onChange={onDisplayModeChange}
        disabled={loading}
        rowClassName={FEED_EDIT_ROW_CLASS_NAME}
        triggerClassName={FEED_EDIT_SELECT_CLASS_NAME}
      />

      {folderSelectProps ? (
        <div
          data-testid="feed-dialog-folder-section"
          data-motion-phase="entering"
          className={MOTION_CONTENT_SWAP_CLASS_NAME}
        >
          <FolderSelectView {...folderSelectProps} layout="inline" />
        </div>
      ) : null}
    </FormDialogShell>
  );
}
