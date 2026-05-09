import { useReducer, useRef } from "react";
import { useTranslation } from "react-i18next";
import type { TagDto } from "@/api/tauri-commands";
import { DeleteTagDialogView } from "@/components/reader/delete-tag-dialog-view";
import { RenameTagDialogView } from "@/components/reader/rename-tag-dialog-view";
import { TagsSettingsView } from "@/components/settings/tags-settings-view";
import { TAG_COLOR_PRESETS } from "@/components/shared/exception-palettes";
import { useCreateTag, useDeleteTag, useRenameTag, useTags } from "@/hooks/use-tags";
import { getErrorMessage } from "@/lib/ui/errors";
import { useUiStore } from "@/stores/ui-store";

type TagsSettingsState = {
  name: string;
  color: string | null;
  editingTag: TagDto | null;
  deletingTag: TagDto | null;
  renameName: string;
  renameColor: string | null;
};

type TagsSettingsAction =
  | { type: "set-name"; value: string }
  | { type: "set-color"; value: string | null }
  | { type: "reset-create" }
  | { type: "start-edit"; tag: TagDto | null }
  | { type: "close-edit" }
  | { type: "set-rename-name"; value: string }
  | { type: "set-rename-color"; value: string | null }
  | { type: "start-delete"; tag: TagDto | null }
  | { type: "close-delete" };

const initialTagsSettingsState: TagsSettingsState = {
  name: "",
  color: null,
  editingTag: null,
  deletingTag: null,
  renameName: "",
  renameColor: null,
};

function tagsSettingsReducer(state: TagsSettingsState, action: TagsSettingsAction): TagsSettingsState {
  switch (action.type) {
    case "set-name":
      return { ...state, name: action.value };
    case "set-color":
      return { ...state, color: action.value };
    case "reset-create":
      return { ...state, name: "", color: null };
    case "start-edit":
      return {
        ...state,
        editingTag: action.tag,
        renameName: action.tag?.name ?? "",
        renameColor: action.tag?.color ?? null,
      };
    case "close-edit":
      return { ...state, editingTag: null, renameName: "", renameColor: null };
    case "set-rename-name":
      return { ...state, renameName: action.value };
    case "set-rename-color":
      return { ...state, renameColor: action.value };
    case "start-delete":
      return { ...state, deletingTag: action.tag };
    case "close-delete":
      return { ...state, deletingTag: null };
    default:
      return state;
  }
}

export function TagsSettings() {
  const { t } = useTranslation("settings");
  const { t: tr } = useTranslation("reader");
  const { data: tags = [] } = useTags();
  const createTag = useCreateTag();
  const renameTag = useRenameTag();
  const deleteTag = useDeleteTag();
  const showToast = useUiStore((state) => state.showToast);
  const [state, dispatch] = useReducer(tagsSettingsReducer, initialTagsSettingsState);
  const createInFlightRef = useRef(false);
  const { name, color, editingTag, deletingTag, renameName, renameColor } = state;

  const handleCreate = async () => {
    const trimmedName = name.trim();
    if (!trimmedName || createInFlightRef.current) {
      return;
    }

    createInFlightRef.current = true;
    try {
      await createTag.mutateAsync({ name: trimmedName, color: color ?? undefined });
      dispatch({ type: "reset-create" });
      showToast(t("tags.create_success"));
    } catch (error) {
      showToast(t("tags.create_failed", { message: getErrorMessage(error) }));
    } finally {
      createInFlightRef.current = false;
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
      dispatch({ type: "close-edit" });
      return;
    }

    try {
      await renameTag.mutateAsync({
        tagId: editingTag.id,
        name: trimmed,
        color: renameColor,
      });
      dispatch({ type: "close-edit" });
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
      dispatch({ type: "close-delete" });
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
        colorOptions={[...TAG_COLOR_PRESETS]}
        noColorLabel={tr("no_color")}
        colorOptionAriaLabel={(option) => `${tr("color")} ${option}`}
        createLabel={t("tags.create")}
        onNameChange={(value) => dispatch({ type: "set-name", value })}
        onColorChange={(value) => dispatch({ type: "set-color", value })}
        onCreate={() => void handleCreate()}
        createDisabled={createTag.isPending || name.trim().length === 0}
        savedHeading={t("tags.saved")}
        emptyState={t("tags.empty_state")}
        tags={tags}
        editLabel={t("tags.edit")}
        editAriaLabel={(tagName) => t("tags.edit_aria_label", { name: tagName })}
        deleteLabel={t("tags.delete")}
        deleteAriaLabel={(tagName) => t("tags.delete_aria_label", { name: tagName })}
        onEdit={(tagId) => dispatch({ type: "start-edit", tag: tags.find((tag) => tag.id === tagId) ?? null })}
        onDelete={(tagId) => dispatch({ type: "start-delete", tag: tags.find((tag) => tag.id === tagId) ?? null })}
      />
      <RenameTagDialogView
        open={editingTag !== null}
        name={renameName}
        color={renameColor}
        loading={renameTag.isPending}
        onOpenChange={(open) => !open && dispatch({ type: "close-edit" })}
        onNameChange={(value) => dispatch({ type: "set-rename-name", value })}
        onColorChange={(value) => dispatch({ type: "set-rename-color", value })}
        colorOptions={[...TAG_COLOR_PRESETS]}
        noColorLabel={tr("no_color")}
        onSubmit={() => void handleRename()}
      />
      <DeleteTagDialogView
        open={deletingTag !== null}
        tagName={deletingTag?.name ?? ""}
        onOpenChange={(open) => !open && dispatch({ type: "close-delete" })}
        onConfirm={() => void handleDelete()}
      />
    </>
  );
}
