import type { QueryClient } from "@tanstack/react-query";
import type { TFunction } from "i18next";
import type { Dispatch, RefObject } from "react";
import type { DiscoveredFeedDto, FolderDto } from "@/api/tauri-commands";
import type { FolderSelectViewProps } from "./folder-select-view";

export type AddFeedDialogSuccessMessage = "feed_url_ready" | "feed_detected";

export type AddFeedDialogState = {
  url: string;
  error: string | null;
  successMessage: AddFeedDialogSuccessMessage | null;
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

export type AddFeedDialogControllerFolderSelectProps = {
  folderSelectValue: string;
  folderOptions: FolderSelectViewProps["options"];
  isCreatingFolder: boolean;
  newFolderName: string;
  newFolderInputRef: RefObject<HTMLInputElement | null>;
  handleFolderChange: (value: string) => void;
  setNewFolderName: (value: string) => void;
};

export type AddFeedDialogControllerDerived = {
  hasManualUrl: boolean;
  isManualUrlValid: boolean;
  urlHint: string | null;
  urlHintTone: "muted" | "error";
  isSubmitDisabled: boolean;
  isDiscoverDisabled: boolean;
  discoveredFeedOptions: Array<{ value: string; label: string }>;
};

export type AddFeedDialogFolderSelectionParams = {
  selectedFolderId: string | null;
  isCreatingFolder: boolean;
  newFolderName: string;
};

export type DiscoveredFeedOption = {
  value: string;
  label: string;
};

export type ResolveAddFeedDialogDerivedParams = {
  state: AddFeedDialogState;
  folderSelection: Pick<AddFeedDialogFolderSelectionParams, "isCreatingFolder" | "newFolderName">;
  invalidUrlHint: string;
  exampleUrlHint: string;
};

export type AddFeedDialogSubmitParams = {
  accountId: string;
  state: AddFeedDialogState;
  derived: Pick<AddFeedDialogControllerDerived, "isManualUrlValid">;
  folderSelection: AddFeedDialogFolderSelectionParams;
  queryClient: QueryClient;
  onOpenChange: (open: boolean) => void;
  showToast: (message: string) => void;
  t: TFunction<"reader">;
};

export type UseAddFeedDialogActionsParams = Omit<AddFeedDialogSubmitParams, "derived"> & {
  dispatch: Dispatch<AddFeedDialogAction>;
  derived: AddFeedDialogControllerDerived;
  trimmedUrl: string;
};

export type UseAddFeedDialogActionsResult = {
  handleDiscover: () => Promise<void>;
  handleSubmit: () => Promise<void>;
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
  folderSelectProps: AddFeedDialogControllerFolderSelectProps;
  derived: AddFeedDialogControllerDerived;
};

export type UseAddFeedDialogViewPropsParams = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folderLabelId: string;
  controller: AddFeedDialogController;
};
