import { useId } from "react";
import { useTranslation } from "react-i18next";
import { useAddFeedDialogController } from "@/components/reader/hooks/feed-dialogs/use-add-feed-dialog-controller";
import { useAddFeedDialogViewProps } from "@/components/reader/hooks/feed-dialogs/use-add-feed-dialog-view-props";
import { useAccounts } from "@/hooks/use-accounts";
import { useFolders } from "@/hooks/use-folders";
import type { AddFeedDialogProps } from "./add-feed-dialog.types";
import { AddFeedDialogView } from "./add-feed-dialog-view";

export function AddFeedDialog({ open, onOpenChange, accountId }: AddFeedDialogProps) {
  const { t } = useTranslation("reader");
  const { data: accounts } = useAccounts();
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
    accountName: accounts?.find((account) => account.id === accountId)?.name,
    controller,
  });

  return <AddFeedDialogView {...viewProps} />;
}
