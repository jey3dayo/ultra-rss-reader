import type { AddFeedDialogViewProps } from "./add-feed-dialog.types";
import { FeedDialogFormView } from "./feed-dialog-form-view";

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
  return (
    <FeedDialogFormView
      open={open}
      onOpenChange={onOpenChange}
      loading={loading}
      isSubmitDisabled={isSubmitDisabled}
      labels={{
        title: labels.title,
        description: labels.description,
        cancel: labels.cancel,
        submit: labels.add,
        submitting: labels.adding,
      }}
      urlSection={{
        value: url,
        onValueChange: onUrlChange,
        onDiscover,
        discoverLabel: labels.discover,
        discoveringLabel: labels.discovering,
        discovering,
        disabled: loading || discovering,
        discoverDisabled: isDiscoverDisabled,
        label: labels.urlLabel,
        placeholder: labels.urlPlaceholder,
        inputRef,
        discoveredFeedsFoundLabel,
        discoveredFeedOptions,
        selectedFeedUrl,
        onSelectedFeedUrlChange,
        helperText: urlHint,
        helperTone: urlHintTone,
      }}
      folderSelectProps={folderSelectProps}
      error={error}
      successMessage={successMessage}
      onSubmit={onSubmit}
    />
  );
}
