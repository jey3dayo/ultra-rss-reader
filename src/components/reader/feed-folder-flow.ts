import { Result } from "@praha/byethrow";
import { type AppError, createFolder } from "@/api/tauri-commands";

export type CreateFolderIfNeededResultParams = {
  accountId: string;
  selectedFolderId: string | null;
  isCreatingFolder: boolean;
  newFolderName: string;
};

export type CreateFolderIfNeededParams = CreateFolderIfNeededResultParams & {
  onError: (error: AppError) => void;
};

export async function createFolderIfNeededResult({
  accountId,
  selectedFolderId,
  isCreatingFolder,
  newFolderName,
}: CreateFolderIfNeededResultParams): Result.ResultAsync<string | null, AppError> {
  if (!isCreatingFolder || !newFolderName.trim()) {
    return Result.succeed(selectedFolderId);
  }

  const result = await createFolder(accountId, newFolderName.trim());

  if (Result.isFailure(result)) {
    return Result.fail(Result.unwrapError(result));
  }

  return Result.succeed(Result.unwrap(result).id);
}

export async function createFolderIfNeeded(params: CreateFolderIfNeededParams): Promise<string | null | undefined> {
  const result = await createFolderIfNeededResult(params);

  if (Result.isFailure(result)) {
    params.onError(Result.unwrapError(result));
    return undefined;
  }

  return Result.unwrap(result);
}
