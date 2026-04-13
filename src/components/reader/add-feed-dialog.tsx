import { useId } from "react";
import { useTranslation } from "react-i18next";
import { useFolders } from "@/hooks/use-folders";
import type { AddFeedDialogProps } from "./add-feed-dialog.types";
import { AddFeedDialogView } from "./add-feed-dialog-view";
import { useAddFeedDialogController } from "./use-add-feed-dialog-controller";
import { useAddFeedDialogViewProps } from "./use-add-feed-dialog-view-props";

export function AddFeedDialog({ open, onOpenChange, accountId }: AddFeedDialogProps) {
  const { t } = useTranslation("reader");
  const { data: folders } = useFolders(accountId);
  const folderLabelId = useId();
  const controller = useAddFeedDialogController({
    open,
    onOpenChange,
    accountId,
    folders,
    noFolderLabel: t("no_folder"),
  });
  const viewProps = useAddFeedDialogViewProps({
    open,
    onOpenChange,
    folderLabelId,
    controller,
  });

  return <AddFeedDialogView {...viewProps} />;
}
