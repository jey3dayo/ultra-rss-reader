import { Copy } from "lucide-react";
import type { RefObject } from "react";
import { MOTION_CONTENT_SWAP_CLASS_NAME } from "@/constants/motion";
import {
  AppTooltip,
  Button,
  DeleteButton,
  FormDialogShell,
  LabeledControlRow,
  LabeledInputRow,
  LabeledSelectRow,
} from "@/design-system";
import type { FeedDialogSelectOption } from "./feed-dialog-form.types";
import type { FeedEditDialogUrlField } from "./feed-edit-dialog.types";
import { FolderSelectView, type FolderSelectViewProps } from "./folder-select-view";

type FeedEditDialogViewLabels = {
  title: string;
  titleField: string;
  displayMode: string;
  cancel: string;
  save: string;
  saving: string;
  unsubscribe: string;
  unsubscribeAction: string;
  feedInformation: string;
  unsubscribeDescription: string;
};

type FeedEditDialogViewProps = {
  open: boolean;
  title: string;
  loading: boolean;
  displayMode: string;
  displayModeOptions: FeedDialogSelectOption[];
  urlFields: FeedEditDialogUrlField[];
  onOpenChange: (open: boolean) => void;
  onTitleChange: (value: string) => void;
  onDisplayModeChange: (value: string) => void;
  folderSelectProps?: FolderSelectViewProps;
  labels: FeedEditDialogViewLabels;
  inputRef?: RefObject<HTMLInputElement | null>;
  onSubmit: () => void;
  onRequestUnsubscribe: () => void;
};

const FEED_EDIT_ROW_CLASS_NAME =
  "min-h-10 border-b-0 py-1.5 sm:grid-cols-[8.5rem_minmax(0,1fr)] sm:items-center sm:gap-x-5 lg:grid-cols-[8.5rem_minmax(0,1fr)] lg:items-center lg:gap-x-5";
const FEED_EDIT_UNSUBSCRIBE_ROW_CLASS_NAME = "sm:grid-cols-[minmax(0,1fr)_auto] lg:grid-cols-[minmax(0,1fr)_auto]";
const FEED_EDIT_CONTROL_CLASS_NAME = "sm:ml-auto sm:max-w-[17rem] lg:max-w-[17rem]";
const FEED_EDIT_INPUT_CLASS_NAME = "min-h-10 bg-surface-1/78 shadow-none";
const FEED_EDIT_SELECT_CLASS_NAME =
  "min-h-10 w-full bg-surface-1/78 shadow-none sm:w-[17rem] sm:justify-self-end lg:w-[17rem] lg:justify-self-end";
const FEED_EDIT_SELECT_POPUP_CLASS_NAME = "w-[var(--anchor-width)]";

function ReadonlyUrlRow({ field, loading }: { field: FeedEditDialogUrlField; loading: boolean }) {
  const canCopy = field.value.trim().length > 0;

  return (
    <LabeledControlRow label={field.label} className={FEED_EDIT_ROW_CLASS_NAME}>
      <div className="flex min-h-10 min-w-0 items-center justify-end gap-1.5 sm:ml-auto sm:w-[17rem] lg:w-[17rem]">
        <span className="min-w-0 flex-1 truncate text-right font-sans text-xs leading-4 text-foreground">
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
              className="size-7 shrink-0 self-center border-0 bg-transparent text-foreground-soft shadow-none hover:bg-transparent hover:text-foreground"
            >
              <Copy className="size-3.5" aria-hidden="true" />
            </Button>
          </AppTooltip>
        ) : null}
      </div>
    </LabeledControlRow>
  );
}

export function FeedEditDialogView({
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
  onRequestUnsubscribe,
}: FeedEditDialogViewProps) {
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
      contentClassName="sm:max-w-[34rem]"
      bodyClassName="space-y-0 py-3"
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

      <LabeledSelectRow
        label={labels.displayMode}
        name="feed-display-mode"
        value={displayMode}
        options={displayModeOptions}
        onChange={onDisplayModeChange}
        disabled={loading}
        rowClassName={FEED_EDIT_ROW_CLASS_NAME}
        triggerClassName={FEED_EDIT_SELECT_CLASS_NAME}
        popupClassName={FEED_EDIT_SELECT_POPUP_CLASS_NAME}
      />

      {folderSelectProps ? (
        <div
          data-testid="feed-dialog-folder-section"
          data-motion-phase="entering"
          className={MOTION_CONTENT_SWAP_CLASS_NAME}
        >
          <FolderSelectView {...folderSelectProps} layout="inline" compact />
        </div>
      ) : null}

      <details data-testid="feed-information" open className="mt-3 border-t border-border/60 pt-2">
        <summary className="cursor-pointer select-none py-1 text-xs font-medium text-foreground-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
          {labels.feedInformation}
        </summary>
        <div className="pt-1">
          {urlFields.map((field) => (
            <ReadonlyUrlRow key={field.key} field={field} loading={loading} />
          ))}
        </div>
      </details>

      <LabeledControlRow
        label={labels.unsubscribe}
        description={labels.unsubscribeDescription}
        className={`${FEED_EDIT_ROW_CLASS_NAME} ${FEED_EDIT_UNSUBSCRIBE_ROW_CLASS_NAME} mt-3 border-t border-border/70 pt-3`}
      >
        {({ descriptionId }) => (
          <DeleteButton
            type="button"
            aria-describedby={descriptionId}
            disabled={loading}
            onClick={onRequestUnsubscribe}
            className="min-h-9 sm:ml-auto sm:flex sm:justify-center"
          >
            {labels.unsubscribeAction}
          </DeleteButton>
        )}
      </LabeledControlRow>
    </FormDialogShell>
  );
}
