import { useCallback, useEffect, useRef, useState } from "react";
import { type FolderSelectOption, NEW_FOLDER_VALUE } from "./folder-select-view";

type FolderOptionSource = {
  id: string;
  name: string;
};

export function buildFolderOptions(
  folders: FolderOptionSource[] | undefined,
  emptyOptionLabel: string,
): FolderSelectOption[] {
  return [
    { value: "", label: emptyOptionLabel },
    ...(folders ?? []).map((folder) => ({ value: folder.id, label: folder.name })),
  ];
}

export function useFolderSelection(initialFolderId: string | null) {
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(initialFolderId);
  const [newFolderName, setNewFolderName] = useState("");
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const newFolderInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isCreatingFolder) {
      requestAnimationFrame(() => newFolderInputRef.current?.focus());
    }
  }, [isCreatingFolder]);

  const resetFolderSelection = useCallback((folderId: string | null) => {
    setSelectedFolderId(folderId);
    setNewFolderName("");
    setIsCreatingFolder(false);
  }, []);

  const handleFolderChange = useCallback((value: string) => {
    if (value === NEW_FOLDER_VALUE) {
      setIsCreatingFolder(true);
      setSelectedFolderId(null);
      return;
    }

    setIsCreatingFolder(false);
    setNewFolderName("");
    setSelectedFolderId(value || null);
  }, []);

  return {
    selectedFolderId,
    newFolderName,
    isCreatingFolder,
    newFolderInputRef,
    folderSelectValue: isCreatingFolder ? NEW_FOLDER_VALUE : (selectedFolderId ?? ""),
    handleFolderChange,
    resetFolderSelection,
    setNewFolderName,
  };
}
