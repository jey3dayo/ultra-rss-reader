import { Result } from "@praha/byethrow";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { AccountDto, FolderDto } from "@/api/tauri-commands";
import { reorderFolders, resetFolderOrder } from "@/api/tauri-commands";
import { invalidateFeedQueries } from "@/lib/query/query-invalidation";
import { queryKeys } from "@/lib/query/query-keys";
import { getErrorMessage } from "@/lib/ui/errors";
import { localizeUserVisibleAppErrorMessage } from "@/lib/ui/localize-app-error-message";
import { useUiStore } from "@/stores/ui-store";

type ReorderFoldersArgs = {
  accountId: string;
  orderedFolderIds: string[];
};

type FolderReorderMutationContext = {
  previousFolders: FolderDto[] | undefined;
  previousAccounts: AccountDto[] | undefined;
};

let reorderChain: Promise<unknown> = Promise.resolve();

function enqueueReorderMutation<T>(task: () => Promise<T>): Promise<T> {
  const next = reorderChain.then(task, task);
  reorderChain = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

function applySortOrderToFolders(folders: FolderDto[], orderedFolderIds: readonly string[]): FolderDto[] {
  const sortOrderById = new Map(orderedFolderIds.map((folderId, index) => [folderId, index]));
  return folders.map((folder) => {
    const nextSortOrder = sortOrderById.get(folder.id);
    return nextSortOrder === undefined ? folder : { ...folder, sort_order: nextSortOrder };
  });
}

function useFolderOrderMutation<TArgs extends ReorderFoldersArgs>(params: {
  mutationFn: (args: TArgs) => Promise<FolderDto[]>;
  folderOrderMode: AccountDto["folder_order_mode"];
}) {
  const { mutationFn, folderOrderMode } = params;
  const { t } = useTranslation("sidebar");
  const queryClient = useQueryClient();
  const showToast = useUiStore((state) => state.showToast);

  return useMutation({
    mutationFn,
    onMutate: async ({ accountId, orderedFolderIds }) => {
      const folderQueryKey = [...queryKeys.folders.root, accountId] as const;
      await queryClient.cancelQueries({ queryKey: queryKeys.folders.root });
      await queryClient.cancelQueries({ queryKey: queryKeys.accounts.root });

      const previousFolders = queryClient.getQueryData<FolderDto[]>(folderQueryKey);
      const previousAccounts = queryClient.getQueryData<AccountDto[]>(queryKeys.accounts.root);

      if (previousFolders) {
        queryClient.setQueryData<FolderDto[]>(
          folderQueryKey,
          applySortOrderToFolders(previousFolders, orderedFolderIds),
        );
      }

      if (folderOrderMode) {
        queryClient.setQueryData<AccountDto[]>(queryKeys.accounts.root, (previousAccountList) =>
          previousAccountList?.map((account) =>
            account.id === accountId ? { ...account, folder_order_mode: folderOrderMode } : account,
          ),
        );
      }

      return { previousFolders, previousAccounts } satisfies FolderReorderMutationContext;
    },
    onSuccess: (folders, { accountId }) => {
      queryClient.setQueryData<FolderDto[]>([...queryKeys.folders.root, accountId], folders);
      invalidateFeedQueries(queryClient, {
        includeFolders: true,
        includeAccounts: true,
        actionOwner: "feed-folder-move",
      });
    },
    onError: (error, { accountId }, context) => {
      showToast(t("folder_reorder_failed", { message: localizeUserVisibleAppErrorMessage(getErrorMessage(error)) }));
      if (context?.previousFolders) {
        queryClient.setQueryData([...queryKeys.folders.root, accountId], context.previousFolders);
      }
      if (context?.previousAccounts) {
        queryClient.setQueryData(queryKeys.accounts.root, context.previousAccounts);
      }
    },
  });
}

export function useReorderFolders() {
  return useFolderOrderMutation({
    mutationFn: async ({ accountId, orderedFolderIds }: ReorderFoldersArgs) =>
      enqueueReorderMutation(async () => {
        const result = await reorderFolders(accountId, orderedFolderIds);
        return Result.unwrap(result);
      }),
    folderOrderMode: "manual",
  });
}

export function useResetFolderOrder() {
  return useFolderOrderMutation({
    mutationFn: async ({ accountId, orderedFolderIds }: ReorderFoldersArgs) => {
      const result = await resetFolderOrder(accountId, orderedFolderIds);
      return Result.unwrap(result);
    },
    folderOrderMode: "name",
  });
}
