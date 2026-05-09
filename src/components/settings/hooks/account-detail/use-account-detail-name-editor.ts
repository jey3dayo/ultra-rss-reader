import { Result } from "@praha/byethrow";
import { type KeyboardEvent, type RefObject, useCallback, useEffect, useReducer, useRef } from "react";
import { renameAccount } from "@/api/tauri-commands";
import { invalidateQueryKeysLogOnly } from "@/lib/query/query-invalidation";
import { updateCachedAccount } from "../../account-detail/query-cache";
import { createAccountDetailErrorToast } from "../../account-detail/toast";
import type { AccountDetailEditorContext } from "../../account-detail/types";
import { scheduleAccountDetailInputFocus } from "./account-detail-editor-focus";

type AccountDetailNameEditorParams = AccountDetailEditorContext;

export type AccountDetailNameEditorResult = {
  editingName: boolean;
  savingName: boolean;
  nameDraft: string;
  setNameDraft: (value: string) => void;
  nameInputRef: RefObject<HTMLInputElement | null>;
  startEditingName: () => void;
  commitRename: () => Promise<void>;
  handleNameKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
};

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
      return { ...state, editingName: true, savingName: false, nameDraft: action.value };
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
}: AccountDetailNameEditorParams): AccountDetailNameEditorResult {
  const [state, dispatch] = useReducer(accountDetailNameEditorReducer, initialAccountDetailNameEditorState);
  const { editingName, savingName, nameDraft } = state;
  const nameInputRef = useRef<HTMLInputElement>(null);
  const cancelScheduledFocusRef = useRef<(() => void) | null>(null);
  const editSessionRef = useRef(0);
  const activeAccountIdRef = useRef(account.id);
  const showRenameError = createAccountDetailErrorToast(t, "account.failed_to_rename");
  const editSessionAtRender = editSessionRef.current;
  activeAccountIdRef.current = account.id;

  const cancelScheduledFocus = useCallback(() => {
    cancelScheduledFocusRef.current?.();
    cancelScheduledFocusRef.current = null;
  }, []);

  useEffect(() => cancelScheduledFocus, [cancelScheduledFocus]);

  const startEditingName = () => {
    editSessionRef.current += 1;
    dispatch({ type: "start-edit", value: account.name });
    cancelScheduledFocus();
    cancelScheduledFocusRef.current = scheduleAccountDetailInputFocus(nameInputRef);
  };

  const commitRename = async () => {
    if (!editingName || editSessionAtRender !== editSessionRef.current) {
      return;
    }

    const trimmed = nameDraft.trim();
    if (!trimmed || trimmed === account.name) {
      editSessionRef.current += 1;
      dispatch({ type: "finish-edit", value: account.name });
      return;
    }

    dispatch({ type: "set-saving-name", value: true });
    const requestAccountId = account.id;
    const requestEditSession = editSessionRef.current;
    let renameSucceeded = false;
    const renameResult = await renameAccount(requestAccountId, trimmed);
    if (activeAccountIdRef.current !== requestAccountId || editSessionRef.current !== requestEditSession) {
      return;
    }

    Result.pipe(
      renameResult,
      Result.inspectError(showRenameError),
      Result.inspect((updated) => {
        renameSucceeded = true;
        editSessionRef.current += 1;
        dispatch({ type: "finish-edit", value: updated.name });
        updateCachedAccount(queryClient, updated);
        invalidateQueryKeysLogOnly(queryClient, [["accounts"]]);
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
      cancelScheduledFocus();
      editSessionRef.current += 1;
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
