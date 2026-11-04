import { useReducer } from "react";
import { useTranslation } from "react-i18next";
import { useCreateTag } from "@/hooks/use-tags";
import { getErrorMessage } from "@/lib/ui/errors";
import { useUiStore } from "@/stores/ui-store";
import { CreateTagDialogView } from "./create-tag-dialog-view";
import { TagSectionContextMenuView } from "./tag-section-context-menu-view";

type TagSectionContextMenuProps = {
  onManageTags: () => void;
};

type TagSectionContextMenuState = {
  showCreateDialog: boolean;
  createName: string;
  createError: string | null;
};

type TagSectionContextMenuAction =
  | { type: "open-create-dialog" }
  | { type: "close-create-dialog" }
  | { type: "set-create-name"; value: string }
  | { type: "set-create-error"; message: string | null };

const initialTagSectionContextMenuState: TagSectionContextMenuState = {
  showCreateDialog: false,
  createName: "",
  createError: null,
};

function tagSectionContextMenuReducer(
  state: TagSectionContextMenuState,
  action: TagSectionContextMenuAction,
): TagSectionContextMenuState {
  switch (action.type) {
    case "open-create-dialog":
      return { ...state, showCreateDialog: true, createError: null };
    case "close-create-dialog":
      return { showCreateDialog: false, createName: "", createError: null };
    case "set-create-name":
      return { ...state, createName: action.value, createError: null };
    case "set-create-error":
      return { ...state, createError: action.message };
    default:
      return state;
  }
}

export function TagSectionContextMenu({ onManageTags }: TagSectionContextMenuProps) {
  const { t } = useTranslation("sidebar");
  const { t: ts } = useTranslation("settings");
  const [state, dispatch] = useReducer(tagSectionContextMenuReducer, initialTagSectionContextMenuState);
  const { showCreateDialog, createName, createError } = state;
  const showToast = useUiStore((state) => state.showToast);
  const createTag = useCreateTag();

  const handleCreate = async () => {
    dispatch({ type: "set-create-error", message: null });
    try {
      await createTag.mutateAsync({ name: createName.trim() });
      dispatch({ type: "close-create-dialog" });
      showToast(ts("tags.create_success"));
    } catch (error) {
      const message = ts("tags.create_failed", { message: getErrorMessage(error) });
      dispatch({ type: "set-create-error", message });
      showToast(message);
    }
  };

  return (
    <>
      <TagSectionContextMenuView
        addTagLabel={t("add_tag")}
        manageTagsLabel={t("manage_tags")}
        onAddTag={() => dispatch({ type: "open-create-dialog" })}
        onManageTags={onManageTags}
      />
      <CreateTagDialogView
        open={showCreateDialog}
        name={createName}
        loading={createTag.isPending}
        errorMessage={createError}
        onOpenChange={(open) => {
          dispatch({ type: open ? "open-create-dialog" : "close-create-dialog" });
        }}
        onNameChange={(value) => dispatch({ type: "set-create-name", value })}
        onSubmit={() => void handleCreate()}
      />
    </>
  );
}
