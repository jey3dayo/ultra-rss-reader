import { CopyableReadonlyFieldList } from "@/components/shared/copyable-readonly-field-list";
import { FormActionButtons } from "@/components/shared/form-action-buttons";
import { StackedInputField } from "@/components/shared/stacked-input-field";
import { StackedSelectField } from "@/components/shared/stacked-select-field";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MOTION_CONTENT_SWAP_CLASS_NAME } from "@/constants/motion";
import { FolderSelectView } from "./folder-select-view";
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
  const submitDisabled = !title.trim() || loading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="overflow-hidden rounded-xl border border-border/70 bg-surface-2 p-0 shadow-elevation-3 sm:max-w-[640px]"
      >
        <DialogHeader className="border-b border-border/70 px-6 py-5">
          <DialogTitle className="text-[1.6rem] font-semibold tracking-tight">{labels.title}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!submitDisabled) {
              onSubmit();
            }
          }}
          className="space-y-5 px-6 py-5"
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
        </form>
        <DialogFooter className="mx-0 mb-0 border-t border-border/70 bg-surface-1/72 px-6 py-4">
          <FormActionButtons
            cancelLabel={labels.cancel}
            submitLabel={labels.save}
            submittingLabel={labels.saving}
            loading={loading}
            submitDisabled={submitDisabled}
            cancelDisabled={loading}
            onCancel={() => onOpenChange(false)}
            onSubmit={onSubmit}
          />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
