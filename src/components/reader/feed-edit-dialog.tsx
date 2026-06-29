import { useId } from "react";
import { useFeedEditDialogController } from "@/components/reader/hooks/feed-dialogs/use-feed-edit-dialog-controller";
import { useFeedEditDialogViewProps } from "@/components/reader/hooks/feed-dialogs/use-feed-edit-dialog-view-props";
import type { FeedEditDialogProps } from "./feed-edit-dialog.types";
import { FeedEditDialogView } from "./feed-edit-dialog-view";

export function FeedEditDialog({ feed, open, onOpenChange }: FeedEditDialogProps) {
  const folderLabelId = useId();
  const controller = useFeedEditDialogController({
    feed,
    open,
    onOpenChange,
  });
  const viewProps = useFeedEditDialogViewProps({
    open,
    feedSiteUrl: feed.site_url,
    feedUrl: feed.url,
    onOpenChange,
    folderLabelId,
    controller,
  });

  return <FeedEditDialogView {...viewProps} />;
}
