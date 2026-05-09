import { useCallback, useEffect, useReducer, useRef } from "react";
import type { FeedDialogFolderSelectionParams } from "../../feed-dialog-form.types";
import { type FolderSelectOption, NEW_FOLDER_VALUE } from "../../folder-select-view";

type FolderOptionSource = {
  id: string;
  name: string;
};

type FolderSelectionState = FeedDialogFolderSelectionParams;

type FolderSelectionAction =
  | { type: "reset"; folderId: string | null }
  | { type: "start-creating-folder" }
  | { type: "select-folder"; folderId: string | null }
  | { type: "set-new-folder-name"; value: string };

function createInitialFolderSelectionState(initialFolderId: string | null): FolderSelectionState {
  return {
    selectedFolderId: initialFolderId,
    newFolderName: "",
    isCreatingFolder: false,
  };
}

function folderSelectionReducer(state: FolderSelectionState, action: FolderSelectionAction): FolderSelectionState {
  switch (action.type) {
    case "reset":
      return createInitialFolderSelectionState(action.folderId);
    case "start-creating-folder":
      return { ...state, isCreatingFolder: true, selectedFolderId: null };
    case "select-folder":
      return {
        ...state,
        isCreatingFolder: false,
        newFolderName: "",
        selectedFolderId: action.folderId,
      };
    case "set-new-folder-name":
      return { ...state, newFolderName: action.value };
    default:
      return state;
  }
}

export function buildFolderOptions(
  folders: FolderOptionSource[] | undefined,
  emptyOptionLabel: string,
): FolderSelectOption[] {
  const seenFolderIds = new Set<string>();
  const folderOptions = (folders ?? []).flatMap((folder) => {
    const folderId = folder.id.trim();
    if (folderId === "" || seenFolderIds.has(folderId)) {
      return [];
    }

    seenFolderIds.add(folderId);
    const folderName = folder.name.trim();
    return [{ value: folderId, label: folderName || folderId }];
  });

  return [{ value: "", label: emptyOptionLabel }, ...folderOptions];
}

export function useFolderSelection(initialFolderId: string | null) {
  const [state, dispatch] = useReducer(folderSelectionReducer, initialFolderId, createInitialFolderSelectionState);
  const { selectedFolderId, newFolderName, isCreatingFolder } = state;
  const newFolderInputRef = useRef<HTMLInputElement>(null);
  const pendingFocusFrameRef = useRef<number | null>(null);
  const isMountedRef = useRef(true);

  const cancelPendingFocusFrame = useCallback(() => {
    if (pendingFocusFrameRef.current !== null) {
      cancelAnimationFrame(pendingFocusFrameRef.current);
      pendingFocusFrameRef.current = null;
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      cancelPendingFocusFrame();
    };
  }, [cancelPendingFocusFrame]);

  useEffect(() => {
    if (!isCreatingFolder) {
      cancelPendingFocusFrame();
      return;
    }

    cancelPendingFocusFrame();
    const focusFrame = requestAnimationFrame(() => {
      if (pendingFocusFrameRef.current !== focusFrame) {
        return;
      }

      pendingFocusFrameRef.current = null;
      if (!isMountedRef.current) {
        return;
      }

      newFolderInputRef.current?.focus();
    });
    pendingFocusFrameRef.current = focusFrame;
  }, [cancelPendingFocusFrame, isCreatingFolder]);

  const resetFolderSelection = useCallback(
    (folderId: string | null) => {
      cancelPendingFocusFrame();
      dispatch({ type: "reset", folderId });
    },
    [cancelPendingFocusFrame],
  );

  const handleFolderChange = useCallback(
    (value: string) => {
      cancelPendingFocusFrame();
      if (value === NEW_FOLDER_VALUE) {
        dispatch({ type: "start-creating-folder" });
        return;
      }

      dispatch({ type: "select-folder", folderId: value || null });
    },
    [cancelPendingFocusFrame],
  );

  return {
    selectedFolderId,
    newFolderName,
    isCreatingFolder,
    newFolderInputRef,
    folderSelectValue: isCreatingFolder ? NEW_FOLDER_VALUE : (selectedFolderId ?? ""),
    handleFolderChange,
    resetFolderSelection,
    setNewFolderName: (value: string) => dispatch({ type: "set-new-folder-name", value }),
  };
}
