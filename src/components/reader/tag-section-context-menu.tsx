import { useTranslation } from "react-i18next";
import { TagSectionContextMenuView } from "./tag-section-context-menu-view";

export type TagSectionContextMenuProps = {
  onAddTag: () => void;
  onManageTags: () => void;
};

export function TagSectionContextMenu({ onAddTag, onManageTags }: TagSectionContextMenuProps) {
  const { t } = useTranslation("sidebar");

  return (
    <TagSectionContextMenuView
      addTagLabel={t("add_tag")}
      manageTagsLabel={t("manage_tags")}
      onAddTag={onAddTag}
      onManageTags={onManageTags}
    />
  );
}
