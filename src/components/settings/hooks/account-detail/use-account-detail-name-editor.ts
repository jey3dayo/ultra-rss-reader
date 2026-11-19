import { Result } from "@praha/byethrow";
import {
  type KeyboardEvent,
  type RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useReducer,
  useRef,
  useState,
} from "react";
import { renameAccount } from "@/api/tauri-commands";
import { normalizeRenameInput } from "@/hooks/normalize-rename-input";
import { scheduleInputFocus } from "@/lib/dom/input-focus";
import { isImeCommitKeyEvent } from "@/lib/keyboard/ime-key-event";
import { invalidateQueryKeysLogOnly, queryKeys } from "@/lib/query/query-invalidation";
import { getErrorMessage } from "@/lib/ui/errors";
import { updateCachedAccount } from "../../account-detail/query-cache";
import { createAccountDetailErrorToast } from "../../account-detail/toast";
import type { AccountDetailEditorContext } from "../../account-detail/types";

type AccountDetailNameEditorParams = AccountDetailEditorContext;

export type AccountDetailNameEditorResult = {
  editingName: boolean;
  savingName: boolean;
  nameDraft: string;
  setNameDraft: (value: string) => void;
  nameInputRef: RefObject<HTMLInputElement | null>;
  startEditingName: () => void;
  commitRename: () => Promise<boolean>;
  cancelRename: () => void;
  nameDirty: boolean;
  nameSaved: boolean;
  handleNameKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  renameErrorMessage: string | null;
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
  const trackedAccountIdRef = useRef(account.id);
  const [renameErrorMessage, setRenameErrorMessage] = useState<string | null>(null);
  const [nameSaved, setNameSaved] = useState(false);
  const savingNameRef = useRef(false);
  const showRenameError = createAccountDetailErrorToast(t, "account.failed_to_rename", {
    persistMessage: setRenameErrorMessage,
  });
  const editSessionAtRender = editSessionRef.current;

  useLayoutEffect(() => {
    activeAccountIdRef.current = account.id;
    if (trackedAccountIdRef.current !== account.id) {
      trackedAccountIdRef.current = account.id;
      setRenameErrorMessage(null);
    }
  });

  const cancelScheduledFocus = useCallback(() => {
    cancelScheduledFocusRef.current?.();
    cancelScheduledFocusRef.current = null;
  }, []);

  useEffect(() => cancelScheduledFocus, [cancelScheduledFocus]);

  const startEditingName = () => {
    editSessionRef.current += 1;
    setRenameErrorMessage(null);
    setNameSaved(false);
    dispatch({ type: "start-edit", value: account.name });
    cancelScheduledFocus();
    cancelScheduledFocusRef.current = scheduleInputFocus(nameInputRef);
  };

  const commitRename = async () => {
    if (savingNameRef.current || (editingName && editSessionAtRender !== editSessionRef.current)) {
      return false;
    }
    if (!editingName) return true;

    const trimmed = normalizeRenameInput(nameDraft);
    if (!trimmed) {
      setRenameErrorMessage(t("account.error_name_required"));
      return false;
    }
    if (trimmed === account.name) {
      editSessionRef.current += 1;
      dispatch({ type: "finish-edit", value: account.name });
      return true;
    }

    savingNameRef.current = true;
    dispatch({ type: "set-saving-name", value: true });
    const requestAccountId = account.id;
    const requestEditSession = editSessionRef.current;
    let renameSucceeded = false;
    try {
      const renameResult = await renameAccount(requestAccountId, trimmed);
      if (activeAccountIdRef.current !== requestAccountId || editSessionRef.current !== requestEditSession)
        return false;
      Result.pipe(
        renameResult,
        Result.inspectError(showRenameError),
        Result.inspect((updated) => {
          renameSucceeded = true;
          setNameSaved(true);
          setRenameErrorMessage(null);
          editSessionRef.current += 1;
          dispatch({ type: "finish-edit", value: updated.name });
          updateCachedAccount(queryClient, updated);
          invalidateQueryKeysLogOnly(queryClient, [queryKeys.accounts.root]);
        }),
      );
    } catch (error) {
      if (activeAccountIdRef.current === requestAccountId && editSessionRef.current === requestEditSession) {
        showRenameError({ message: getErrorMessage(error) });
      }
    } finally {
      if (!renameSucceeded) dispatch({ type: "set-saving-name", value: false });
      savingNameRef.current = false;
    }
    return renameSucceeded;
  };

  const cancelRename = () => {
    if (savingNameRef.current) return;
    cancelScheduledFocus();
    editSessionRef.current += 1;
    setRenameErrorMessage(null);
    dispatch({ type: "cancel-edit" });
  };

  const handleNameKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    // The IME owns the keystroke: Enter would save a half-typed name, Escape would
    // discard the edit. isComposing alone misses the commit Enter on macOS WebKit.
    if (isImeCommitKeyEvent(event.nativeEvent)) {
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      void commitRename();
    } else if (event.key === "Escape") {
      cancelRename();
    }
  };

  return {
    editingName,
    savingName,
    nameDraft,
    setNameDraft: (value) => {
      editSessionRef.current += 1;
      setRenameErrorMessage(null);
      dispatch({ type: "set-name-draft", value });
    },
    nameInputRef,
    startEditingName,
    commitRename,
    cancelRename,
    nameDirty: editingName && nameDraft !== account.name,
    nameSaved,
    handleNameKeyDown,
    renameErrorMessage,
  };
}
