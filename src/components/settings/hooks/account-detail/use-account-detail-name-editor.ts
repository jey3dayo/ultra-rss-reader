import { Result } from "@praha/byethrow";
import { type KeyboardEvent, useReducer, useRef } from "react";
import { renameAccount } from "@/api/tauri-commands";
import { updateCachedAccount } from "../../account-detail/query-cache";
import { createAccountDetailErrorToast } from "../../account-detail/toast";
import type { UseAccountDetailNameEditorParams, UseAccountDetailNameEditorResult } from "../../account-detail/types";

type AccountDetailNameEditorState = {
  editingName: boolean;
  savingName: boolean;
  nameDraft: string;
};

type AccountDetailNameEditorAction =
  | { type: "start-edit"; value: string }
  | { type: "set-name-draft"; value: string }
  | { type: "set-saving-name"; value: boolean }
  | { type: "finish-edit"; value: string }
  | { type: "cancel-edit" };

const initialAccountDetailNameEditorState: AccountDetailNameEditorState = {
  editingName: false,
  savingName: false,
  nameDraft: "",
};

function accountDetailNameEditorReducer(
  state: AccountDetailNameEditorState,
  action: AccountDetailNameEditorAction,
): AccountDetailNameEditorState {
  switch (action.type) {
    case "start-edit":
      return { ...state, editingName: true, nameDraft: action.value };
    case "set-name-draft":
      return { ...state, nameDraft: action.value };
    case "set-saving-name":
      return { ...state, savingName: action.value };
    case "finish-edit":
      return { editingName: false, savingName: false, nameDraft: action.value };
    case "cancel-edit":
      return { ...state, editingName: false };
    default:
      return state;
  }
}

export function useAccountDetailNameEditor({
  account,
  queryClient,
  t,
}: UseAccountDetailNameEditorParams): UseAccountDetailNameEditorResult {
  const [state, dispatch] = useReducer(accountDetailNameEditorReducer, initialAccountDetailNameEditorState);
  const { editingName, savingName, nameDraft } = state;
  const nameInputRef = useRef<HTMLInputElement>(null);
  const showRenameError = createAccountDetailErrorToast(t, "account.failed_to_rename");

  const startEditingName = () => {
    dispatch({ type: "start-edit", value: account.name });
    requestAnimationFrame(() => {
      nameInputRef.current?.focus();
      nameInputRef.current?.select();
    });
  };

  const commitRename = async () => {
    const trimmed = nameDraft.trim();
    if (!trimmed || trimmed === account.name) {
      dispatch({ type: "finish-edit", value: account.name });
      return;
    }

    dispatch({ type: "set-saving-name", value: true });
    let renameSucceeded = false;
    Result.pipe(
      await renameAccount(account.id, trimmed),
      Result.inspectError(showRenameError),
      Result.inspect((updated) => {
        renameSucceeded = true;
        dispatch({ type: "finish-edit", value: updated.name });
        updateCachedAccount(queryClient, updated);
        queryClient.invalidateQueries({ queryKey: ["accounts"] });
      }),
    );
    if (!renameSucceeded) {
      dispatch({ type: "set-saving-name", value: false });
    }
  };

  const handleNameKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      void commitRename();
    } else if (event.key === "Escape") {
      dispatch({ type: "cancel-edit" });
    }
  };

  return {
    editingName,
    savingName,
    nameDraft,
    setNameDraft: (value) => dispatch({ type: "set-name-draft", value }),
    nameInputRef,
    startEditingName,
    commitRename,
    handleNameKeyDown,
  };
}
