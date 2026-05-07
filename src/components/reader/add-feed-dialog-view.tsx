import { useId } from "react";
import { FormActionButtons } from "@/components/shared/form-action-buttons";
import { SurfaceCard } from "@/components/shared/surface-card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MOTION_CONTENT_SWAP_CLASS_NAME } from "@/constants/motion";
import type { AddFeedDialogViewProps } from "./add-feed-dialog.types";
import { FeedDialogUrlSection } from "./feed-dialog-url-section";
import { FolderSelectView } from "./folder-select-view";

export function AddFeedDialogView({
  open,
  onOpenChange,
  url,
  onUrlChange,
  onDiscover,
  discovering,
  loading,
  discoveredFeedsFoundLabel,
  discoveredFeedOptions,
  selectedFeedUrl,
  onSelectedFeedUrlChange,
  folderSelectProps,
  error,
  successMessage,
  urlHint,
  urlHintTone,
  isDiscoverDisabled,
  isSubmitDisabled,
  labels,
  inputRef,
  onSubmit,
}: AddFeedDialogViewProps) {
  const urlHelperTextId = useId();
  const urlInputId = useId();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="overflow-hidden rounded-xl border border-border/70 bg-surface-2 p-0 shadow-elevation-3 sm:max-w-[640px]"
      >
        <DialogHeader className="border-b border-border/70 px-6 py-4">
          <DialogTitle className="text-[1.45rem] font-semibold tracking-tight">{labels.title}</DialogTitle>
          <DialogDescription className="max-w-[46ch] text-[0.82rem] leading-5 text-foreground-soft">
            {labels.description}
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!isSubmitDisabled) {
              onSubmit();
            }
          }}
          className="space-y-4 px-6 py-4"
        >
          <FeedDialogUrlSection
            value={url}
            onValueChange={onUrlChange}
            onDiscover={onDiscover}
            discoverLabel={labels.discover}
            discoveringLabel={labels.discovering}
            discovering={discovering}
            disabled={loading || discovering}
            discoverDisabled={isDiscoverDisabled}
            label={labels.urlLabel}
            placeholder={labels.urlPlaceholder}
            inputRef={inputRef}
            inputId={urlInputId}
            helperTextId={urlHelperTextId}
            discoveredFeedsFoundLabel={discoveredFeedsFoundLabel}
            discoveredFeedOptions={discoveredFeedOptions}
            selectedFeedUrl={selectedFeedUrl}
            onSelectedFeedUrlChange={onSelectedFeedUrlChange}
            helperText={urlHint}
            helperTone={urlHintTone}
          />

          <div
            data-testid="feed-dialog-folder-section"
            data-motion-phase="entering"
            className={`${MOTION_CONTENT_SWAP_CLASS_NAME} rounded-md border border-border/70 bg-surface-1/80 px-4 py-3`}
          >
            <FolderSelectView {...folderSelectProps} />
          </div>

          {successMessage && !error ? (
            <SurfaceCard
              variant="info"
              tone="success"
              padding="compact"
              data-motion-phase="entering"
              className={MOTION_CONTENT_SWAP_CLASS_NAME}
            >
              <p className="text-sm">{successMessage}</p>
            </SurfaceCard>
          ) : null}
          {error ? (
            <SurfaceCard
              variant="info"
              tone="danger"
              padding="compact"
              data-motion-phase="entering"
              className={MOTION_CONTENT_SWAP_CLASS_NAME}
            >
              <p className="text-sm">{error}</p>
            </SurfaceCard>
          ) : null}
        </form>
        <DialogFooter className="mx-0 mb-0 border-t border-border/70 bg-surface-1/72 px-6 py-4">
          <FormActionButtons
            cancelLabel={labels.cancel}
            submitLabel={labels.add}
            submittingLabel={labels.adding}
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
