import { Result } from "@praha/byethrow";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { AccountDto, FolderDto } from "@/api/tauri-commands";
import { reorderFolders, resetFolderOrder } from "@/api/tauri-commands";
import { invalidateFeedQueries } from "@/lib/query/query-invalidation";
import { queryKeys } from "@/lib/query/query-keys";
import { localizeUserVisibleAppErrorMessage } from "@/lib/ui/localize-app-error-message";
import { useUiStore } from "@/stores/ui-store";

type ReorderFoldersArgs = {
  accountId: string;
  orderedFolderIds: string[];
};

type FolderReorderMutationContext = {
  previousFolders: FolderDto[] | undefined;
  previousAccounts: AccountDto[] | undefined;
  startedAlone: boolean;
};

let reorderChain: Promise<unknown> = Promise.resolve();

// onMutate runs before the serialized IPC, so only a mutation that started with nothing in flight may roll back
// and only the last save of a burst writes the cache; after a failure the DB is reloaded.
let pendingReorderCount = 0;
let reorderBurstFailed = false;

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
  const queryClient = useQueryClient();
  const { t } = useTranslation("sidebar");
  const showToast = useUiStore((state) => state.showToast);

  return useMutation({
    mutationFn,
    onMutate: async ({ accountId, orderedFolderIds }) => {
      const startedAlone = pendingReorderCount === 0;
      pendingReorderCount += 1;
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

      return { previousFolders, previousAccounts, startedAlone } satisfies FolderReorderMutationContext;
    },
    onSuccess: (folders, { accountId }) => {
      if (pendingReorderCount > 1) {
        return;
      }
      queryClient.setQueryData<FolderDto[]>([...queryKeys.folders.root, accountId], folders);
      invalidateFeedQueries(queryClient, {
        includeFolders: true,
        includeAccounts: true,
        actionOwner: "feed-folder-move",
      });
    },
    onError: (error, { accountId }, context) => {
      reorderBurstFailed = true;
      if (context?.startedAlone) {
        if (context.previousFolders) {
          queryClient.setQueryData([...queryKeys.folders.root, accountId], context.previousFolders);
        }
        if (context.previousAccounts) {
          queryClient.setQueryData(queryKeys.accounts.root, context.previousAccounts);
        }
      }
      showToast(t("folder_reorder_failed", { message: localizeUserVisibleAppErrorMessage(error.message) }));
    },
    onSettled: () => {
      pendingReorderCount -= 1;
      if (pendingReorderCount === 0 && reorderBurstFailed) {
        reorderBurstFailed = false;
        invalidateFeedQueries(queryClient, {
          includeFolders: true,
          includeAccounts: true,
          actionOwner: "feed-folder-move",
        });
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
    mutationFn: async ({ accountId, orderedFolderIds }: ReorderFoldersArgs) =>
      enqueueReorderMutation(async () => {
        const result = await resetFolderOrder(accountId, orderedFolderIds);
        return Result.unwrap(result);
      }),
    folderOrderMode: "name",
  });
}
