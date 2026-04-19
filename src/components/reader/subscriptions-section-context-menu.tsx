import { useTranslation } from "react-i18next";
import { SubscriptionsSectionContextMenuView } from "./subscriptions-section-context-menu-view";

export type SubscriptionsSectionContextMenuProps = {
  folderIds: string[];
  onExpandAllFolders: (folderIds: string[]) => void;
  onCollapseAllFolders: () => void;
};

export function SubscriptionsSectionContextMenu({
  folderIds,
  onExpandAllFolders,
  onCollapseAllFolders,
}: SubscriptionsSectionContextMenuProps) {
  const { t } = useTranslation("sidebar");

  return (
    <SubscriptionsSectionContextMenuView
      expandAllFoldersLabel={t("expand_all_folders")}
      collapseAllFoldersLabel={t("collapse_all_folders")}
      onExpandAllFolders={() => onExpandAllFolders(folderIds)}
      onCollapseAllFolders={onCollapseAllFolders}
    />
  );
}
