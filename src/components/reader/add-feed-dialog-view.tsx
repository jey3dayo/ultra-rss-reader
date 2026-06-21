import { type RefObject, useId } from "react";
import { MOTION_CONTENT_SWAP_CLASS_NAME } from "@/constants/motion";
import { FormDialogShell, SurfaceCard } from "@/design-system";
import type { AddFeedDialogViewLabels, DiscoveredFeedOption } from "./add-feed-dialog.types";
import { FeedDialogUrlSection } from "./feed-dialog-url-section";
import { FolderSelectView, type FolderSelectViewProps } from "./folder-select-view";

export type AddFeedDialogViewProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  url: string;
  onUrlChange: (value: string) => void;
  onDiscover: () => void;
  discovering: boolean;
  loading: boolean;
  discoveredFeedsFoundLabel: string | null;
  discoveredFeedOptions: DiscoveredFeedOption[];
  selectedFeedUrl: string;
  onSelectedFeedUrlChange: (value: string) => void;
  folderSelectProps: FolderSelectViewProps;
  error: string | null;
  successMessage: string | null;
  urlHint: string | null;
  urlHintTone: "muted" | "error";
  isDiscoverDisabled: boolean;
  isSubmitDisabled: boolean;
  labels: AddFeedDialogViewLabels;
  inputRef?: RefObject<HTMLInputElement | null>;
  onSubmit: () => void;
};

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
    <FormDialogShell
      open={open}
      title={labels.title}
      description={labels.description}
      cancelLabel={labels.cancel}
      submitLabel={labels.add}
      submittingLabel={labels.adding}
      loading={loading}
      submitDisabled={isSubmitDisabled}
      cancelDisabled={loading}
      size="wide"
      onOpenChange={onOpenChange}
      onSubmit={onSubmit}
    >
      <div
        data-testid="feed-dialog-form-panel"
        className={`${MOTION_CONTENT_SWAP_CLASS_NAME} motion-contextual-surface overflow-hidden rounded-md border border-border/70 bg-surface-1/72 shadow-elevation-1`}
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
          className={`${MOTION_CONTENT_SWAP_CLASS_NAME} border-t border-border/70`}
        >
          <FolderSelectView {...folderSelectProps} layout="inline" />
        </div>
      </div>

      <div role="status" aria-live="polite" aria-atomic="true">
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
      </div>
    </FormDialogShell>
  );
}
