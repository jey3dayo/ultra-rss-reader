import { Result } from "@praha/byethrow";
import { renameFeed } from "@/api/tauri-commands";
import { displayPresetToTriStateModes, resolveFeedDisplayPreset } from "@/lib/articles/article-display";
import { createFolderIfNeededResult } from "./feed-folder-flow";
import { invalidateFeedQueries } from "./feed-query-cache";
import type { FeedEditDisplayPreset, SubmitFeedEditsParams } from "./rename-feed-dialog.types";

export type {
  FeedEditDisplayPreset,
  SubmitFeedEditsParams,
} from "./rename-feed-dialog.types";
export type FeedEditorState<ExtraState extends object = object> = {
  title: string;
  displayPreset: FeedEditDisplayPreset;
  loading: boolean;
} & ExtraState;

export async function submitFeedEdits({
  feed,
  title,
  displayPreset,
  folderSelection,
  queryClient,
  showToast,
  createFolderErrorMessage,
  renameErrorMessage,
  updateFeedFolder,
  updateDisplaySettings,
}: SubmitFeedEditsParams) {
  const trimmed = title.trim();
  const folderResult = await createFolderIfNeededResult({
    accountId: feed.account_id,
    selectedFolderId: folderSelection.selectedFolderId,
    isCreatingFolder: folderSelection.isCreatingFolder,
    newFolderName: folderSelection.newFolderName,
  });

  if (Result.isFailure(folderResult)) {
    showToast(createFolderErrorMessage(Result.unwrapError(folderResult)));
    return false;
  }

  const resolvedFolderId = Result.unwrap(folderResult);
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
    includeFeeds: didMoveFolder || (didRename && renameSucceeded) || (didUpdateDisplayMode && displaySettingsSucceeded),
  });

  return renameSucceeded && displaySettingsSucceeded;
}
