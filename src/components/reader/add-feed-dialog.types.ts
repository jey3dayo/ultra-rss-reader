import type { RefObject } from "react";
import type { DiscoveredFeedDto } from "@/api/tauri-commands";
import type { FolderSelectViewProps } from "./folder-select-view";

export type AddFeedDialogState = {
  url: string;
  error: string | null;
  successMessage: string | null;
  loading: boolean;
  discovering: boolean;
  discoveredFeeds: DiscoveredFeedDto[];
  selectedFeedUrl: string | null;
};

export type AddFeedDialogAction =
  | { type: "reset" }
  | { type: "set-url"; url: string }
  | { type: "start-discover" }
  | { type: "discover-empty" }
  | { type: "discover-single"; feeds: DiscoveredFeedDto[] }
  | { type: "discover-multiple"; feeds: DiscoveredFeedDto[] }
  | { type: "discover-error"; error: string }
  | { type: "set-selected-feed-url"; url: string | null }
  | { type: "set-invalid-url-error"; error: string }
  | { type: "set-loading"; loading: boolean }
  | { type: "set-submit-error"; error: string };

export type AddFeedDialogViewLabels = {
  title: string;
  description: string;
  urlLabel: string;
  urlPlaceholder: string;
  discover: string;
  discovering: string;
  cancel: string;
  add: string;
  adding: string;
};

export type AddFeedDialogViewProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  url: string;
  onUrlChange: (value: string) => void;
  onDiscover: () => void;
  discovering: boolean;
  loading: boolean;
  discoveredFeedsFoundLabel: string | null;
  discoveredFeedOptions: Array<{ value: string; label: string }>;
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
