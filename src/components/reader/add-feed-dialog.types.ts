import type { RefObject } from "react";
import type { DiscoveredFeedDto, FolderDto } from "@/api/tauri-commands";
import type { FeedDialogControllerFolderSelectProps } from "./feed-dialog-form.types";

type AddFeedDialogSuccessMessage = "feed_url_ready" | "feed_detected";

export type AddFeedDialogState = {
  url: string;
  error: string | null;
  successMessage: AddFeedDialogSuccessMessage | null;
  loading: boolean;
  discovering: boolean;
  discoveryRequestId: number | null;
  discoveredFeeds: DiscoveredFeedDto[];
  selectedFeedUrl: string | null;
};

export type AddFeedDialogAction =
  | { type: "reset" }
  | { type: "set-url"; url: string }
  | { type: "start-discover"; requestId?: number }
  | { type: "discover-empty"; requestId?: number }
  | { type: "discover-single"; feeds: DiscoveredFeedDto[]; requestId?: number }
  | {
      type: "discover-multiple";
      feeds: DiscoveredFeedDto[];
      requestId?: number;
    }
  | { type: "discover-error"; error: string; requestId?: number }
  | { type: "set-selected-feed-url"; url: string | null }
  | { type: "set-invalid-url-error"; error: string }
  | { type: "set-loading"; loading: boolean }
  | { type: "set-submit-error"; error: string };

export type AddFeedDialogControllerParams = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string;
  folders: FolderDto[] | undefined;
  noFolderLabel: string;
};

export type AddFeedDialogProps = Omit<AddFeedDialogControllerParams, "folders" | "noFolderLabel">;

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

export type AddFeedDialogControllerDerived = {
  hasManualUrl: boolean;
  isManualUrlValid: boolean;
  urlHint: string | null;
  urlHintTone: "muted" | "error";
  isSubmitDisabled: boolean;
  isDiscoverDisabled: boolean;
  discoveredFeedOptions: DiscoveredFeedOption[];
};

export type AddFeedDialogFolderSelectionParams = {
  selectedFolderId: string | null;
  isCreatingFolder: boolean;
  newFolderName: string;
};

export type DiscoveredFeedOption = {
  value: string;
  label: string;
  description?: string;
};

export type ResolveAddFeedDialogDerivedParams = {
  state: AddFeedDialogState;
  folderSelection: Pick<AddFeedDialogFolderSelectionParams, "isCreatingFolder" | "newFolderName">;
  invalidUrlHint: string;
  exampleUrlHint: string;
};

export type AddFeedDialogController = {
  inputRef: RefObject<HTMLInputElement | null>;
  url: string;
  error: string | null;
  successMessage: string | null;
  loading: boolean;
  discovering: boolean;
  discoveredFeeds: DiscoveredFeedDto[];
  selectedFeedUrl: string | null;
  setUrl: (url: string) => void;
  setSelectedFeedUrl: (value: string | null) => void;
  handleDiscover: () => Promise<void>;
  handleSubmit: () => Promise<void>;
  folderSelectProps: FeedDialogControllerFolderSelectProps;
  derived: AddFeedDialogControllerDerived;
};
