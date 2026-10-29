import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import type { FolderDto } from "@/api/tauri-commands";
import { useReorderFolders, useResetFolderOrder } from "@/hooks/use-folder-reorder";
import {
  buildFullFolderOrderAfterVisibleMove,
  buildNameOrderedFolderIds,
  type FolderOrderMode,
  resolveFolderOrderMode,
} from "@/lib/sidebar/folder-order";
import { useUiStore } from "@/stores/ui-store";

type UseSidebarFolderReorderActionsParams = {
  accountId: string | null;
  folderOrderMode: FolderOrderMode | undefined;
  folders: FolderDto[] | undefined;
  visibleOrderedFolderIds: readonly string[];
};

export function useSidebarFolderReorderActions({
  accountId,
  folderOrderMode,
  folders,
  visibleOrderedFolderIds,
}: UseSidebarFolderReorderActionsParams) {
  const { t } = useTranslation("sidebar");
  const showConfirm = useUiStore((state) => state.showConfirm);
  const reorderFoldersMutation = useReorderFolders();
  const resetFolderOrderMutation = useResetFolderOrder();
  const [liveRegionMessage, setLiveRegionMessage] = useState<string | null>(null);

  const resolvedFolderOrderMode = resolveFolderOrderMode(folderOrderMode);
  const folderList = folders ?? [];

  const submitFolderOrder = useCallback(
    async (orderedFolderIds: readonly string[]) => {
      if (!accountId) {
        return;
      }
      await reorderFoldersMutation.mutateAsync({ accountId, orderedFolderIds: [...orderedFolderIds] });
    },
    [accountId, reorderFoldersMutation],
  );

  const reorderFolderToVisibleIndex = useCallback(
    (movedFolderId: string, targetVisibleIndex: number) => {
      const nextOrder = buildFullFolderOrderAfterVisibleMove({
        folders: folderList,
        folderOrderMode: resolvedFolderOrderMode,
        visibleOrderedFolderIds,
        movedFolderId,
        targetVisibleIndex,
      });
      submitFolderOrder(nextOrder).catch(() => undefined); // surfaced by the mutation's onError toast
    },
    [folderList, resolvedFolderOrderMode, submitFolderOrder, visibleOrderedFolderIds],
  );

  const resetFolderOrder = useCallback(() => {
    if (!accountId || folderList.length === 0) {
      return;
    }

    const executeReset = async () => {
      try {
        await resetFolderOrderMutation.mutateAsync({
          accountId,
          orderedFolderIds: buildNameOrderedFolderIds(folderList),
        });
      } catch {
        return;
      }
      setLiveRegionMessage(t("folder_reorder_reset"));
    };

    if (resolvedFolderOrderMode === "manual") {
      showConfirm(t("folder_reset_order_confirm"), executeReset, {
        actionLabel: t("folder_reset_order"),
        variant: "warning",
      });
      return;
    }

    executeReset();
  }, [accountId, folderList, resetFolderOrderMutation, resolvedFolderOrderMode, showConfirm, t]);

  return {
    resolvedFolderOrderMode,
    liveRegionMessage,
    setLiveRegionMessage,
    reorderFolderToVisibleIndex,
    resetFolderOrder,
    isReorderPending: reorderFoldersMutation.isPending || resetFolderOrderMutation.isPending,
  };
}
