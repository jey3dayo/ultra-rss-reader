import type { QueryClient } from "@tanstack/react-query";
import type { RefObject } from "react";
import type { FeedDto, FolderDto } from "@/api/tauri-commands";
import type { FeedDisplayPresetOption, TriStateDisplayMode } from "@/lib/articles/article-display";
import type {
  FeedDialogControllerFolderSelectProps,
  FeedDialogFolderSelectionParams,
  FeedDialogReadonlyFieldProps,
} from "./feed-dialog-form.types";

export type FeedEditDisplayPreset = FeedDisplayPresetOption;
export type RenameFeedDialogUrlField = Omit<FeedDialogReadonlyFieldProps, "name">;

type FeedEditErrorLike = {
  message: string;
};

type FeedEditFolderSelectionParams = FeedDialogFolderSelectionParams & {
  availableFolderIds?: readonly string[];
};

export type SubmitFeedEditsParams = {
  feed: FeedDto;
  title: string;
  displayPreset: FeedEditDisplayPreset;
  folderSelection: FeedEditFolderSelectionParams;
  queryClient: QueryClient;
  showToast: (message: string) => void;
  createFolderErrorMessage: (error: FeedEditErrorLike) => string;
  renameErrorMessage: (error: FeedEditErrorLike) => string;
  updateFeedFolder: (args: { feedId: string; folderId: string | null }) => Promise<boolean>;
  updateDisplaySettings: (
    feedId: string,
    readerMode: TriStateDisplayMode,
    webPreviewMode: TriStateDisplayMode,
  ) => Promise<boolean>;
};

export type RenameFeedDialogControllerParams = {
  feed: FeedDto;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export type RenameDialogProps = RenameFeedDialogControllerParams;

export type RenameFeedDialogController = {
  title: string;
  loading: boolean;
  displayPreset: FeedEditDisplayPreset;
  inputRef: RefObject<HTMLInputElement | null>;
  folders: FolderDto[] | undefined;
  setTitle: (value: string) => void;
  setDisplayPreset: (value: FeedEditDisplayPreset) => void;
  handleCopy: (value: string) => Promise<void>;
  handleSubmit: () => Promise<void>;
  folderSelectProps: FeedDialogControllerFolderSelectProps;
};
