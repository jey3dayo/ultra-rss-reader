import { useId } from "react";
import { CopyableReadonlyFieldList } from "@/components/shared/copyable-readonly-field-list";
import { FormActionButtons } from "@/components/shared/form-action-buttons";
import { StackedInputField } from "@/components/shared/stacked-input-field";
import { StackedSelectField } from "@/components/shared/stacked-select-field";
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
        className="overflow-hidden rounded-2xl border border-border/70 bg-[linear-gradient(180deg,hsl(var(--card)/0.98),hsl(var(--background)/0.98))] p-0 shadow-[0_28px_80px_-44px_hsl(var(--foreground)/0.55)] sm:max-w-[640px]"
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
            <div className="rounded-xl border border-border/70 bg-card/55 px-4 py-4">
              <FolderSelectView {...folderSelectProps} />
            </div>
          ) : null}

          {successMessage && !error && <p className="mt-2 text-sm text-green-400">{successMessage}</p>}
          {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
        </form>
        <DialogFooter className="border-t border-border/70 bg-background/55 px-6 py-4">
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
