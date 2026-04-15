import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TagDto } from "@/api/tauri-commands";
import { DeleteTagDialogView } from "@/components/reader/delete-tag-dialog-view";
import { RenameTagDialogView } from "@/components/reader/rename-tag-dialog-view";
import { TagsSettingsView } from "@/components/settings/tags-settings-view";
import { useCreateTag, useDeleteTag, useRenameTag, useTags } from "@/hooks/use-tags";
import { useUiStore } from "@/stores/ui-store";

const TAG_COLOR_PRESETS = [
  "#cf7868",
  "#c88d62",
  "#b59a64",
  "#5f9670",
  "#5f9695",
  "#6f8eb8",
  "#8c79b2",
  "#b97a90",
  "#726d66",
] as const;

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "object" && error !== null && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return "Unknown error";
}

export function TagsSettings() {
  const { t } = useTranslation("settings");
  const { t: tr } = useTranslation("reader");
  const showToast = useUiStore((state) => state.showToast);
  const { data: tags = [] } = useTags();
  const createTag = useCreateTag();
  const renameTag = useRenameTag();
  const deleteTag = useDeleteTag();
  const [name, setName] = useState("");
  const [color, setColor] = useState<string | null>(null);
  const [editingTag, setEditingTag] = useState<TagDto | null>(null);
  const [deletingTag, setDeletingTag] = useState<TagDto | null>(null);
  const [renameName, setRenameName] = useState("");
  const [renameColor, setRenameColor] = useState<string | null>(null);

  useEffect(() => {
    if (!editingTag) {
      return;
    }

    setRenameName(editingTag.name);
    setRenameColor(editingTag.color);
  }, [editingTag]);

  const handleCreate = async () => {
    try {
      await createTag.mutateAsync({ name: name.trim(), color });
      setName("");
      setColor(null);
      showToast(t("tags.create_success"));
    } catch (error) {
      showToast(t("tags.create_failed", { message: getErrorMessage(error) }));
    }
  };

  const handleRename = async () => {
    if (!editingTag) {
      return;
    }

    const trimmed = renameName.trim();
    const nameChanged = trimmed !== editingTag.name;
    const colorChanged = renameColor !== editingTag.color;
    if (!trimmed || (!nameChanged && !colorChanged)) {
      setEditingTag(null);
      return;
    }

    try {
      await renameTag.mutateAsync({
        tagId: editingTag.id,
        name: trimmed,
        color: renameColor,
      });
      setEditingTag(null);
      showToast(t("tags.rename_success"));
    } catch (error) {
      showToast(t("tags.rename_failed", { message: getErrorMessage(error) }));
    }
  };

  const handleDelete = async () => {
    if (!deletingTag) {
      return;
    }

    try {
      await deleteTag.mutateAsync({ tagId: deletingTag.id });
      setDeletingTag(null);
      showToast(t("tags.delete_success"));
    } catch (error) {
      showToast(t("tags.delete_failed", { message: getErrorMessage(error) }));
    }
  };

  return (
    <>
      <TagsSettingsView
        title={t("tags.heading")}
        addHeading={t("tags.add_heading")}
        intro={t("tags.note")}
        nameLabel={t("tags.name")}
        nameValue={name}
        namePlaceholder={t("tags.name_placeholder")}
        colorLabel={tr("color")}
        colorValue={color}
        colorOptions={TAG_COLOR_PRESETS}
        noColorLabel={tr("no_color")}
        colorOptionAriaLabel={(option) => `${tr("color")} ${option}`}
        createLabel={t("tags.create")}
        onNameChange={setName}
        onColorChange={setColor}
        onCreate={() => void handleCreate()}
        createDisabled={createTag.isPending || name.trim().length === 0}
        savedHeading={t("tags.saved")}
        emptyState={t("tags.empty_state")}
        tags={tags}
        editLabel={t("tags.edit")}
        editAriaLabel={(tagName) => t("tags.edit_aria_label", { name: tagName })}
        deleteLabel={t("tags.delete")}
        deleteAriaLabel={(tagName) => t("tags.delete_aria_label", { name: tagName })}
        onEdit={(tagId) => setEditingTag(tags.find((tag) => tag.id === tagId) ?? null)}
        onDelete={(tagId) => setDeletingTag(tags.find((tag) => tag.id === tagId) ?? null)}
      />

      <RenameTagDialogView
        open={editingTag !== null}
        name={renameName}
        color={renameColor}
        loading={renameTag.isPending}
        onOpenChange={(open) => !open && setEditingTag(null)}
        onNameChange={setRenameName}
        onColorChange={setRenameColor}
        colorOptions={[...TAG_COLOR_PRESETS]}
        noColorLabel={tr("no_color")}
        onSubmit={() => void handleRename()}
      />

      <DeleteTagDialogView
        open={deletingTag !== null}
        tagName={deletingTag?.name ?? ""}
        onOpenChange={(open) => !open && setDeletingTag(null)}
        onConfirm={() => void handleDelete()}
      />
    </>
  );
}
