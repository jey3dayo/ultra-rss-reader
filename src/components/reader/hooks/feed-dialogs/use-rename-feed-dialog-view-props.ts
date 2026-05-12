import { useTranslation } from "react-i18next";
import { buildRenameFeedDialogViewProps } from "../../lib/rename-feed-dialog-view-props";
import type { RenameFeedDialogController } from "../../rename-feed-dialog.types";

type UseRenameFeedDialogViewPropsParams = {
  open: boolean;
  feedSiteUrl: string;
  feedUrl: string;
  onOpenChange: (open: boolean) => void;
  folderLabelId: string;
  controller: RenameFeedDialogController;
};

export function useRenameFeedDialogViewProps({
  open,
  feedSiteUrl,
  feedUrl,
  onOpenChange,
  folderLabelId,
  controller,
}: UseRenameFeedDialogViewPropsParams) {
  const { t } = useTranslation("reader");
  const { t: tc } = useTranslation("common");

  return buildRenameFeedDialogViewProps({
    open,
    feedSiteUrl,
    feedUrl,
    onOpenChange,
    folderLabelId,
    controller,
    t,
    tc,
  });
}
