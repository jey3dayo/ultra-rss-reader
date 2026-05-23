import { useTranslation } from "react-i18next";
import {
  type BuildRenameFeedDialogViewPropsParams,
  buildRenameFeedDialogViewProps,
} from "../../lib/rename-feed-dialog-view-props";

type UseRenameFeedDialogViewPropsParams = Omit<BuildRenameFeedDialogViewPropsParams, "t" | "tc">;

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
