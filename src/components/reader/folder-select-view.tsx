import type { RefObject } from "react";
import { StackedInputField } from "@/components/shared/stacked-input-field";
import { StackedSelectField } from "@/components/shared/stacked-select-field";

export const NEW_FOLDER_VALUE = "__new__";

export type FolderSelectOption = {
  value: string;
  label: string;
};

export type FolderSelectViewProps = {
  labelId?: string;
  label: string;
  value: string;
  options: FolderSelectOption[];
  canCreateFolder: boolean;
  disabled: boolean;
  isCreatingFolder: boolean;
  newFolderOptionLabel: string;
  newFolderLabel: string;
  newFolderName: string;
  newFolderPlaceholder: string;
  onValueChange: (value: string) => void;
  onNewFolderNameChange: (value: string) => void;
  newFolderInputRef?: RefObject<HTMLInputElement | null>;
};

export function FolderSelectView({
  labelId,
  label,
  value,
  options,
  canCreateFolder,
  disabled,
  isCreatingFolder,
  newFolderOptionLabel,
  newFolderLabel,
  newFolderName,
  newFolderPlaceholder,
  onValueChange,
  onNewFolderNameChange,
  newFolderInputRef,
}: FolderSelectViewProps) {
  const resolvedOptions = [
    ...options.filter((option) => canCreateFolder || option.value !== NEW_FOLDER_VALUE),
    ...(canCreateFolder && !options.some((option) => option.value === NEW_FOLDER_VALUE)
      ? [{ value: NEW_FOLDER_VALUE, label: newFolderOptionLabel }]
      : []),
  ];

  return (
    <>
      <StackedSelectField
        labelId={labelId}
        label={label}
        name="feed-folder"
        value={value}
        options={resolvedOptions.map((option) => ({ value: option.value, label: option.label }))}
        onChange={onValueChange}
        disabled={disabled}
        triggerClassName="mt-1 w-full"
      />

      {canCreateFolder && isCreatingFolder && (
        <StackedInputField
          label={newFolderLabel}
          inputRef={newFolderInputRef}
          name="new-folder-name"
          type="text"
          value={newFolderName}
          onChange={onNewFolderNameChange}
          placeholder={newFolderPlaceholder}
          inputClassName="mt-1"
          disabled={disabled}
        />
      )}
    </>
  );
}
