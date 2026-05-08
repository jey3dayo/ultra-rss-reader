import { type RefObject, useId } from "react";
import { FormDialogShell } from "@/components/shared/form-dialog-shell";
import { SurfaceCard } from "@/components/shared/surface-card";
import { MOTION_CONTENT_SWAP_CLASS_NAME } from "@/constants/motion";
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
    </FormDialogShell>
  );
}
