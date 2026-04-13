import { Result } from "@praha/byethrow";
import { type AppError, createFolder } from "@/api/tauri-commands";

export type CreateFolderIfNeededParams = {
  accountId: string;
  selectedFolderId: string | null;
  isCreatingFolder: boolean;
  newFolderName: string;
  onError: (error: AppError) => void;
};

export async function createFolderIfNeeded({
  accountId,
  selectedFolderId,
  isCreatingFolder,
  newFolderName,
  onError,
}: CreateFolderIfNeededParams): Promise<string | null | undefined> {
  if (!isCreatingFolder || !newFolderName.trim()) {
    return selectedFolderId;
  }

  let resolvedFolderId: string | null = selectedFolderId;
  let failed = false;

  Result.pipe(
    await createFolder(accountId, newFolderName.trim()),
    Result.inspect((folder) => {
      resolvedFolderId = folder.id;
    }),
    Result.inspectError((error) => {
      failed = true;
      onError(error);
    }),
  );

  return failed ? undefined : resolvedFolderId;
}
