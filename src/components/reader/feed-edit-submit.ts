import { Result } from "@praha/byethrow";
import type { QueryClient } from "@tanstack/react-query";
import type { FeedDto } from "@/api/tauri-commands";
import { renameFeed } from "@/api/tauri-commands";
import { displayPresetToTriStateModes, resolveFeedDisplayPreset } from "@/lib/article-display";
import { createFolderIfNeeded } from "./feed-folder-flow";

export type FeedEditDisplayPreset = "default" | "standard" | "preview";

type ErrorLike = {
  message: string;
};

type SubmitFeedEditsParams = {
  feed: FeedDto;
  title: string;
  displayPreset: FeedEditDisplayPreset;
  selectedFolderId: string | null;
  isCreatingFolder: boolean;
  newFolderName: string;
  queryClient: QueryClient;
  showToast: (message: string) => void;
  createFolderErrorMessage: (error: ErrorLike) => string;
  renameErrorMessage: (error: ErrorLike) => string;
  updateFeedFolder: (args: { feedId: string; folderId: string | null }) => Promise<boolean>;
  updateDisplaySettings: (
    feedId: string,
    readerMode: "inherit" | "on" | "off",
    webPreviewMode: "inherit" | "on" | "off",
  ) => Promise<unknown>;
};

export async function submitFeedEdits({
  feed,
  title,
  displayPreset,
  selectedFolderId,
  isCreatingFolder,
  newFolderName,
  queryClient,
  showToast,
  createFolderErrorMessage,
  renameErrorMessage,
  updateFeedFolder,
  updateDisplaySettings,
}: SubmitFeedEditsParams) {
  const trimmed = title.trim();
  const resolvedFolderId = await createFolderIfNeeded({
    accountId: feed.account_id,
    selectedFolderId,
    isCreatingFolder,
    newFolderName,
    onError: (error) => {
      showToast(createFolderErrorMessage(error));
    },
  });

  if (resolvedFolderId === undefined) {
    return false;
  }

  const didRename = trimmed !== feed.title;
  const didMoveFolder = resolvedFolderId !== feed.folder_id;
  const currentDisplayPreset = resolveFeedDisplayPreset(feed);
  const didUpdateDisplayMode = displayPreset !== currentDisplayPreset;
  let folderUpdateSucceeded = false;

  if (didRename) {
    Result.pipe(
      await renameFeed(feed.id, trimmed),
      Result.inspectError((error) => {
        showToast(renameErrorMessage(error));
      }),
    );
  }

  if (didMoveFolder) {
    folderUpdateSucceeded = await updateFeedFolder({
      feedId: feed.id,
      folderId: resolvedFolderId,
    });
  }

  if (didUpdateDisplayMode) {
    const nextModes = displayPresetToTriStateModes(displayPreset);
    await updateDisplaySettings(feed.id, nextModes.readerMode, nextModes.webPreviewMode);
  }

  if ((didRename || didUpdateDisplayMode) && !folderUpdateSucceeded) {
    void queryClient.invalidateQueries({ queryKey: ["feeds"] });
  }

  void queryClient.invalidateQueries({ queryKey: ["folders"] });

  return true;
}
