import { Result } from "@praha/byethrow";
import { renameFeed } from "@/api/tauri-commands";
import { displayPresetToTriStateModes, resolveFeedDisplayPreset } from "@/lib/article-display";
import { createFolderIfNeeded } from "./feed-folder-flow";
import { invalidateFeedQueries } from "./feed-query-cache";
import type { SubmitFeedEditsParams } from "./rename-feed-dialog.types";

export type { FeedEditDisplayPreset, SubmitFeedEditsParams } from "./rename-feed-dialog.types";

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
  let renameSucceeded = true;
  let displaySettingsSucceeded = true;

  if (didRename) {
    Result.pipe(
      await renameFeed(feed.id, trimmed),
      Result.inspect(() => {
        renameSucceeded = true;
      }),
      Result.inspectError((error) => {
        renameSucceeded = false;
        showToast(renameErrorMessage(error));
      }),
    );
  }

  if (didMoveFolder) {
    await updateFeedFolder({
      feedId: feed.id,
      folderId: resolvedFolderId,
    });
  }

  if (didUpdateDisplayMode) {
    const nextModes = displayPresetToTriStateModes(displayPreset);
    displaySettingsSucceeded = await updateDisplaySettings(feed.id, nextModes.readerMode, nextModes.webPreviewMode);
  }

  invalidateFeedQueries(queryClient, {
    includeFeeds: (didRename && renameSucceeded) || (didUpdateDisplayMode && displaySettingsSucceeded),
  });

  return renameSucceeded && displaySettingsSucceeded;
}
