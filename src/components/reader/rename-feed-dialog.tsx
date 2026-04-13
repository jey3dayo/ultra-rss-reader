import { useId } from "react";
import type { RenameDialogProps } from "./rename-feed-dialog.types";
import { RenameFeedDialogView } from "./rename-feed-dialog-view";
import { useRenameFeedDialogController } from "./use-rename-feed-dialog-controller";
import { useRenameFeedDialogViewProps } from "./use-rename-feed-dialog-view-props";

export function RenameDialog({ feed, open, onOpenChange }: RenameDialogProps) {
  const folderLabelId = useId();
  const controller = useRenameFeedDialogController({
    feed,
    open,
    onOpenChange,
  });
  const viewProps = useRenameFeedDialogViewProps({
    open,
    feedSiteUrl: feed.site_url,
    feedUrl: feed.url,
    onOpenChange,
    folderLabelId,
    controller,
  });

  return <RenameFeedDialogView {...viewProps} />;
}
