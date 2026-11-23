import { Result } from "@praha/byethrow";
import { renameFeed } from "@/api/tauri-commands";
import { normalizeRenameInput } from "@/hooks/normalize-rename-input";
import { displayPresetToTriStateModes, resolveFeedDisplayPreset } from "@/lib/articles/article-display";
import { invalidateFeedEditQueries } from "@/lib/query/query-invalidation";
import type {
  FeedEditDisplayPreset,
  FeedEditStepOutcome,
  FeedEditTitleError,
  SubmitFeedEditsParams,
} from "./feed-edit-dialog.types";
import { createFolderIfNeededResult } from "./feed-folder-flow";

export type { SubmitFeedEditsParams } from "./feed-edit-dialog.types";

export type SubmitFeedEditsResult = {
  success: boolean;
  /**
   * Per-step outcomes, set only when some attempted steps succeeded and others
   * failed. Null when everything succeeded, everything failed, or the save
   * aborted before any step ran.
   */
  partialOutcomes: readonly FeedEditStepOutcome[] | null;
};

type FeedMutationEditorState<ExtraState extends object = object> = {
  title: string;
  displayPreset: FeedEditDisplayPreset;
  loading: boolean;
} & ExtraState;

export type FeedEditorState<ExtraState extends object = object> = FeedMutationEditorState<ExtraState>;

export function validateFeedEditTitle(title: string): FeedEditTitleError | null {
  return normalizeRenameInput(title) === "" ? "required" : null;
}

export async function submitFeedEdits({
  feed,
  title,
  displayPreset,
  folderSelection,
  queryClient,
  reportError,
  createFolderErrorMessage,
  renameErrorMessage,
  updateFeedFolder,
  updateDisplaySettings,
}: SubmitFeedEditsParams): Promise<SubmitFeedEditsResult> {
  const trimmed = normalizeRenameInput(title);
  const folderResult = await createFolderIfNeededResult({
    accountId: feed.account_id,
    selectedFolderId: folderSelection.selectedFolderId,
    isCreatingFolder: folderSelection.isCreatingFolder,
    newFolderName: folderSelection.newFolderName,
    availableFolderIds: folderSelection.availableFolderIds,
  });

  if (Result.isFailure(folderResult)) {
    reportError(createFolderErrorMessage(Result.unwrapError(folderResult)));
    return { success: false, partialOutcomes: null };
  }

  const resolvedFolderId = Result.unwrap(folderResult);
  const didRename = trimmed !== feed.title;
  const didMoveFolder = resolvedFolderId !== feed.folder_id;
  const currentDisplayPreset = resolveFeedDisplayPreset(feed);
  const didUpdateDisplayMode = displayPreset !== currentDisplayPreset;
  let renameSucceeded = true;
  let folderMoveSucceeded = true;
  let displaySettingsSucceeded = true;

  if (didRename) {
    Result.pipe(
      await renameFeed(feed.id, trimmed),
      Result.inspect(() => {
        renameSucceeded = true;
      }),
      Result.inspectError((error) => {
        renameSucceeded = false;
        reportError(renameErrorMessage(error));
      }),
    );
  }

  if (didMoveFolder) {
    folderMoveSucceeded = await updateFeedFolder({
      feedId: feed.id,
      folderId: resolvedFolderId,
    });
  }

  if (didUpdateDisplayMode) {
    const nextModes = displayPresetToTriStateModes(displayPreset);
    displaySettingsSucceeded = await updateDisplaySettings(feed.id, nextModes.readerMode, nextModes.webPreviewMode);
  }

  invalidateFeedEditQueries(
    queryClient,
    (didMoveFolder && folderMoveSucceeded) ||
      (didRename && renameSucceeded) ||
      (didUpdateDisplayMode && displaySettingsSucceeded),
  );

  const success = renameSucceeded && folderMoveSucceeded && displaySettingsSucceeded;
  const outcomes: FeedEditStepOutcome[] = [];
  if (didRename) {
    outcomes.push({ step: "rename", succeeded: renameSucceeded });
  }
  if (didMoveFolder) {
    outcomes.push({ step: "folder", succeeded: folderMoveSucceeded });
  }
  if (didUpdateDisplayMode) {
    outcomes.push({ step: "display", succeeded: displaySettingsSucceeded });
  }
  const isPartial = outcomes.some((outcome) => outcome.succeeded) && outcomes.some((outcome) => !outcome.succeeded);

  return { success, partialOutcomes: isPartial ? outcomes : null };
}
