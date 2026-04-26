import { useReducer } from "react";
import { useTranslation } from "react-i18next";
import { CreateTagDialogView } from "@/components/settings/create-tag-dialog-view";
import { useCreateTag } from "@/hooks/use-tags";
import { getErrorMessage } from "@/lib/errors";
import { useUiStore } from "@/stores/ui-store";
import { TagSectionContextMenuView } from "./tag-section-context-menu-view";

export type TagSectionContextMenuProps = {
  onManageTags: () => void;
};

type TagSectionContextMenuState = {
  showCreateDialog: boolean;
  createName: string;
};

type TagSectionContextMenuAction =
  | { type: "open-create-dialog" }
  | { type: "close-create-dialog" }
  | { type: "set-create-name"; value: string };

const initialTagSectionContextMenuState: TagSectionContextMenuState = {
  showCreateDialog: false,
  createName: "",
};

function tagSectionContextMenuReducer(
  state: TagSectionContextMenuState,
  action: TagSectionContextMenuAction,
): TagSectionContextMenuState {
  switch (action.type) {
    case "open-create-dialog":
      return { ...state, showCreateDialog: true };
    case "close-create-dialog":
      return { showCreateDialog: false, createName: "" };
    case "set-create-name":
      return { ...state, createName: action.value };
    default:
      return state;
  }
}

export function TagSectionContextMenu({ onManageTags }: TagSectionContextMenuProps) {
  const { t } = useTranslation("sidebar");
  const { t: ts } = useTranslation("settings");
  const [state, dispatch] = useReducer(tagSectionContextMenuReducer, initialTagSectionContextMenuState);
  const { showCreateDialog, createName } = state;
  const showToast = useUiStore((state) => state.showToast);
  const createTag = useCreateTag();

  const handleCreate = async () => {
    try {
      await createTag.mutateAsync({ name: createName.trim() });
      dispatch({ type: "close-create-dialog" });
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
        onAddTag={() => dispatch({ type: "open-create-dialog" })}
        onManageTags={onManageTags}
      />
      <CreateTagDialogView
        open={showCreateDialog}
        name={createName}
        loading={createTag.isPending}
        onOpenChange={(open) => {
          dispatch({ type: open ? "open-create-dialog" : "close-create-dialog" });
        }}
        onNameChange={(value) => dispatch({ type: "set-create-name", value })}
        onSubmit={() => void handleCreate()}
      />
    </>
  );
}
