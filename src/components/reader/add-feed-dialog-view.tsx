import type { RefObject } from "react";
import type { DiscoveredFeedOption } from "./discovered-feed-options-view";
import { FeedDialogFormView } from "./feed-dialog-form-view";
import type { FolderSelectViewProps } from "./folder-select-view";

export type AddFeedDialogViewLabels = {
  title: string;
  description: string;
  urlPlaceholder: string;
  discover: string;
  discovering: string;
  cancel: string;
  add: string;
  adding: string;
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
  isDiscoverDisabled,
  isSubmitDisabled,
  labels,
  inputRef,
  onSubmit,
}: {
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
  isDiscoverDisabled: boolean;
  isSubmitDisabled: boolean;
  labels: AddFeedDialogViewLabels;
  inputRef?: RefObject<HTMLInputElement | null>;
  onSubmit: () => void;
}) {
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
        placeholder: labels.urlPlaceholder,
        inputRef,
        discoveredFeedsFoundLabel,
        discoveredFeedOptions,
        selectedFeedUrl,
        onSelectedFeedUrlChange,
      }}
      folderSelectProps={folderSelectProps}
      error={error}
      successMessage={successMessage}
      onSubmit={onSubmit}
    />
  );
}
