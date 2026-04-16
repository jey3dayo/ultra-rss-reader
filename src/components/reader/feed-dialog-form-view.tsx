import { useId } from "react";
import { CopyableReadonlyFieldList } from "@/components/shared/copyable-readonly-field-list";
import { FormActionButtons } from "@/components/shared/form-action-buttons";
import { StackedInputField } from "@/components/shared/stacked-input-field";
import { StackedSelectField } from "@/components/shared/stacked-select-field";
import { SurfaceCard } from "@/components/shared/surface-card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { FeedDialogFormViewProps } from "./feed-dialog-form.types";

export type {
  FeedDialogFormLabels,
  FeedDialogFormUrlSectionProps,
  FeedDialogReadonlyFieldProps,
  FeedDialogSelectOption,
  FeedDialogSelectSectionProps,
  FeedDialogTextSectionProps,
} from "./feed-dialog-form.types";

import { FeedDialogUrlSection } from "./feed-dialog-url-section";
import { FolderSelectView } from "./folder-select-view";

export function FeedDialogFormView({
  open,
  onOpenChange,
  loading,
  isSubmitDisabled,
  labels,
  urlSection,
  textSection,
  readonlyFields,
  selectSection,
  folderSelectProps,
  error,
  successMessage,
  onSubmit,
}: FeedDialogFormViewProps) {
  const urlHelperTextId = useId();
  const urlInputId = useId();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="overflow-hidden rounded-xl border border-border/70 bg-surface-2 p-0 shadow-elevation-3 sm:max-w-[640px]"
      >
        <DialogHeader className="border-b border-border/70 px-6 py-5">
          <DialogTitle className="text-[1.6rem] font-semibold tracking-tight">{labels.title}</DialogTitle>
          {labels.description ? (
            <DialogDescription className="max-w-[46ch] text-sm leading-6 text-muted-foreground/90">
              {labels.description}
            </DialogDescription>
          ) : null}
        </DialogHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!isSubmitDisabled) {
              onSubmit();
            }
          }}
          className="space-y-5 px-6 py-5"
        >
          {urlSection && <FeedDialogUrlSection {...urlSection} inputId={urlInputId} helperTextId={urlHelperTextId} />}

          {textSection && (
            <StackedInputField
              label={textSection.label}
              inputRef={textSection.inputRef}
              name={textSection.name}
              type="text"
              value={textSection.value}
              onChange={textSection.onValueChange}
              inputClassName="mt-1"
              disabled={textSection.disabled}
            />
          )}

          {readonlyFields && <CopyableReadonlyFieldList fields={readonlyFields} />}

          {selectSection && (
            <StackedSelectField
              label={selectSection.label}
              name={selectSection.name}
              value={selectSection.value}
              options={selectSection.options}
              onChange={selectSection.onValueChange}
              disabled={selectSection.disabled}
              triggerClassName="mt-1 w-full"
            />
          )}

          {folderSelectProps ? (
            <div
              data-testid="feed-dialog-folder-section"
              className="rounded-md border border-border/70 bg-surface-1/80 px-4 py-4"
            >
              <FolderSelectView {...folderSelectProps} />
            </div>
          ) : null}

          {successMessage && !error ? (
            <SurfaceCard variant="info" tone="success" padding="compact">
              <p className="text-sm">{successMessage}</p>
            </SurfaceCard>
          ) : null}
          {error ? (
            <SurfaceCard variant="info" tone="danger" padding="compact">
              <p className="text-sm">{error}</p>
            </SurfaceCard>
          ) : null}
        </form>
        <DialogFooter className="border-t border-border/70 bg-surface-1/72 px-6 py-4">
          <FormActionButtons
            cancelLabel={labels.cancel}
            submitLabel={labels.submit}
            submittingLabel={labels.submitting}
            loading={loading}
            submitDisabled={isSubmitDisabled}
            cancelDisabled={loading}
            onCancel={() => onOpenChange(false)}
            onSubmit={onSubmit}
          />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
