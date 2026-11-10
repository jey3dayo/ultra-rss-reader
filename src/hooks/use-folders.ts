import { type FolderDto, listFolders, renameFolder } from "@/api/tauri-commands";
import { createMutation } from "@/hooks/create-mutation";
import { createQuery } from "@/hooks/create-query";
import { invalidateQueryKeysLogOnly, queryKeys } from "@/lib/query/query-invalidation";

export const useFolders = createQuery(queryKeys.folders.root, listFolders);

export const useRenameFolder = createMutation(
  ({ folderId, name }: { folderId: string; name: string }) => renameFolder(folderId, name),
  (queryClient, { folderId, name }) => {
    queryClient.setQueriesData<FolderDto[]>({ queryKey: queryKeys.folders.root }, (folders) =>
      folders?.map((folder) => (folder.id === folderId ? { ...folder, name } : folder)),
    );
    void invalidateQueryKeysLogOnly(queryClient, [queryKeys.folders.root]);
  },
);
