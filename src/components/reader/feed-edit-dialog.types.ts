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
export type FeedEditTitleError = "required";
export type FeedEditDialogUrlField = Omit<FeedDialogReadonlyFieldProps, "name">;

type FeedEditErrorLike = {
  message: string;
};

type FeedEditFolderSelectionParams = FeedDialogFolderSelectionParams & {
  availableFolderIds?: readonly string[];
};

export type SubmitFeedEditsParams = {
  feed: FeedDto;
  title: string;
  /** Edited feed URL for local feeds; null when the URL is not editable (provider feeds). */
  feedUrl: string | null;
  displayPreset: FeedEditDisplayPreset;
  folderSelection: FeedEditFolderSelectionParams;
  queryClient: QueryClient;
  reportError: (message: string) => void;
  createFolderErrorMessage: (error: FeedEditErrorLike) => string;
  renameErrorMessage: (error: FeedEditErrorLike) => string;
  updateUrlErrorMessage: (error: FeedEditErrorLike) => string;
  updateFeedFolder: (args: { feedId: string; folderId: string | null }) => Promise<boolean>;
  updateDisplaySettings: (
    feedId: string,
    readerMode: TriStateDisplayMode,
    webPreviewMode: TriStateDisplayMode,
  ) => Promise<boolean>;
};

export type FeedEditDialogControllerParams = {
  feed: FeedDto;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** True when the feed belongs to a local account, so its URL can be replaced in place. */
  feedUrlEditable: boolean;
  /**
   * Claims the shared save/unsubscribe operation slot. Returns false when another
   * operation is already in flight, or when the feed's account is no longer the
   * selected account (checked against live store state, not a stale closure).
   */
  claimOperation: () => boolean;
  /** Releases the shared operation slot claimed by {@link claimOperation}. */
  releaseOperation: () => void;
};

export type FeedEditDialogProps = {
  accountScope?: "subscriptions";
  feed: FeedDto;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export type FeedEditSaveStep = "rename" | "url" | "folder" | "display";

export type FeedEditStepOutcome = {
  step: FeedEditSaveStep;
  succeeded: boolean;
};

export type FeedEditSaveSummary = {
  saved: readonly FeedEditSaveStep[];
  remaining: readonly FeedEditSaveStep[];
};

export type FeedEditDialogController = {
  title: string;
  feedUrl: string;
  feedUrlEditable: boolean;
  loading: boolean;
  displayPreset: FeedEditDisplayPreset;
  titleError: FeedEditTitleError | null;
  saveErrorMessages: readonly string[];
  saveSummary: FeedEditSaveSummary | null;
  inputRef: RefObject<HTMLInputElement | null>;
  folders: FolderDto[] | undefined;
  setTitle: (value: string) => void;
  setFeedUrl: (value: string) => void;
  setDisplayPreset: (value: FeedEditDisplayPreset) => void;
  handleCopy: (value: string) => Promise<void>;
  handleSubmit: () => Promise<void>;
  folderSelectProps: FeedDialogControllerFolderSelectProps;
};
