import { useState } from "react";
import { useTranslation } from "react-i18next";
import { CreateTagDialogView } from "@/components/settings/create-tag-dialog-view";
import { useCreateTag } from "@/hooks/use-tags";
import { useUiStore } from "@/stores/ui-store";
import { TagSectionContextMenuView } from "./tag-section-context-menu-view";

export type TagSectionContextMenuProps = {
  onManageTags: () => void;
};

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "object" && error !== null && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return "Unknown error";
}

export function TagSectionContextMenu({ onManageTags }: TagSectionContextMenuProps) {
  const { t } = useTranslation("sidebar");
  const { t: ts } = useTranslation("settings");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createName, setCreateName] = useState("");
  const showToast = useUiStore((state) => state.showToast);
  const createTag = useCreateTag();

  const handleCreate = async () => {
    try {
      await createTag.mutateAsync({ name: createName.trim() });
      setCreateName("");
      setShowCreateDialog(false);
      showToast(ts("tags.create_success"));
    } catch (error) {
      showToast(ts("tags.create_failed", { message: getErrorMessage(error) }));
    }
  };

  return (
    <>
      <TagSectionContextMenuView
        addTagLabel={t("add_tag")}
        manageTagsLabel={t("manage_tags")}
        onAddTag={() => setShowCreateDialog(true)}
        onManageTags={onManageTags}
      />
      <CreateTagDialogView
        open={showCreateDialog}
        name={createName}
        loading={createTag.isPending}
        onOpenChange={(open) => {
          setShowCreateDialog(open);
          if (!open) {
            setCreateName("");
          }
        }}
        onNameChange={setCreateName}
        onSubmit={() => void handleCreate()}
      />
    </>
  );
}
