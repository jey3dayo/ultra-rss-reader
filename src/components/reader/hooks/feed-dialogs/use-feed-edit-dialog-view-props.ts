import { useTranslation } from "react-i18next";
import {
  type BuildFeedEditDialogViewPropsParams,
  buildFeedEditDialogViewProps,
} from "../../lib/feed-edit-dialog-view-props";

type UseFeedEditDialogViewPropsParams = Omit<BuildFeedEditDialogViewPropsParams, "t" | "tc">;

export function useFeedEditDialogViewProps({
  open,
  feedSiteUrl,
  feedUrl,
  onOpenChange,
  folderLabelId,
  controller,
}: UseFeedEditDialogViewPropsParams) {
  const { t } = useTranslation("reader");
  const { t: tc } = useTranslation("common");

  return buildFeedEditDialogViewProps({
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
