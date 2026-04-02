import { Result } from "@praha/byethrow";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { updateFeedFolder } from "@/api/tauri-commands";
import { useUiStore } from "@/stores/ui-store";

type UpdateFeedFolderArgs = {
  feedId: string;
  folderId: string | null;
};

export function useUpdateFeedFolder() {
  const { t } = useTranslation("reader");
  const qc = useQueryClient();
  const showToast = useUiStore((state) => state.showToast);

  return useMutation<null, { message: string }, UpdateFeedFolderArgs>({
    mutationFn: async ({ feedId, folderId }) => {
      const result = await updateFeedFolder(feedId, folderId);
      return Result.unwrap(result);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["feeds"] });
    },
    onError: (error) => {
      showToast(t("failed_to_update_folder", { message: error.message }));
    },
  });
}
