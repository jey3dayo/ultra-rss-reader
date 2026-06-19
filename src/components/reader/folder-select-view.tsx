import type { RefObject } from "react";
import { StackedInputField } from "@/components/shared/stacked-input-field";
import { StackedSelectField } from "@/components/shared/stacked-select-field";

export const NEW_FOLDER_VALUE = "__new__";
const FOLDER_OPTION_VALUE_PREFIX = "folder:";

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
  layout?: "stacked" | "inline";
};

function encodeFolderOptionValue(value: string) {
  return value === "" ? value : `${FOLDER_OPTION_VALUE_PREFIX}${value}`;
}

function decodeFolderSelectValue(value: string) {
  if (value === NEW_FOLDER_VALUE || value === "") {
    return value;
  }

  return value.startsWith(FOLDER_OPTION_VALUE_PREFIX) ? value.slice(FOLDER_OPTION_VALUE_PREFIX.length) : value;
}

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
  layout = "stacked",
}: FolderSelectViewProps) {
  const hasSelectedValue = value !== "" && value !== NEW_FOLDER_VALUE;
  const hasSelectedOption = options.some((option) => option.value === value);
  const resolvedOptions = [...options, ...(hasSelectedValue && !hasSelectedOption ? [{ value, label: value }] : [])];
  const selectOptions = [
    ...resolvedOptions.map((option) => ({
      value: encodeFolderOptionValue(option.value),
      label: option.label,
    })),
    ...(canCreateFolder ? [{ value: NEW_FOLDER_VALUE, label: newFolderOptionLabel }] : []),
  ];

  return (
    <>
      <StackedSelectField
        labelId={labelId}
        label={label}
        name="feed-folder"
        value={isCreatingFolder && value === NEW_FOLDER_VALUE ? NEW_FOLDER_VALUE : encodeFolderOptionValue(value)}
        options={selectOptions}
        onChange={(nextValue) => onValueChange(decodeFolderSelectValue(nextValue))}
        disabled={disabled}
        className={
          layout === "inline" ? "grid gap-2 px-4 py-3.5 sm:grid-cols-[7rem_minmax(0,1fr)] sm:items-start" : undefined
        }
        labelClassName={layout === "inline" ? "mb-0 whitespace-nowrap sm:pt-2.5" : undefined}
        triggerClassName={layout === "inline" ? "min-h-11 w-full bg-surface-2" : "mt-1 w-full"}
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
          className={
            layout === "inline" ? "grid gap-2 px-4 pb-3.5 sm:grid-cols-[7rem_minmax(0,1fr)] sm:items-start" : undefined
          }
          labelClassName={layout === "inline" ? "whitespace-nowrap sm:pt-2.5" : undefined}
          inputClassName={layout === "inline" ? "min-h-11 bg-surface-2" : "mt-1"}
          disabled={disabled}
        />
      )}
    </>
  );
}
