import type { RefObject } from "react";
import { StackedInputField, StackedSelectField } from "@/design-system";
import type { OptionWithLabel } from "@/lib/ui/options";

export const NEW_FOLDER_VALUE = "__new__";
const FOLDER_OPTION_VALUE_PREFIX = "folder:";

export type FolderSelectOption = OptionWithLabel;

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

const FOLDER_SELECT_INLINE_ROW_CLASS_NAME =
  "grid min-h-[52px] grid-cols-1 items-start gap-y-2.5 border-b-0 py-2.5 sm:grid-cols-[minmax(8.5rem,12rem)_minmax(0,1fr)] sm:items-center sm:gap-x-8 sm:gap-y-3";
const FOLDER_SELECT_INLINE_LABEL_CLASS_NAME =
  "mb-0 whitespace-nowrap font-sans text-[13px] leading-[1.35] font-medium text-[color:var(--form-row-label)] lg:pt-0";
const FOLDER_SELECT_INLINE_CONTROL_CLASS_NAME =
  "min-h-11 w-full bg-surface-1/78 shadow-none sm:w-[20rem] sm:justify-self-end";

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
        className={layout === "inline" ? FOLDER_SELECT_INLINE_ROW_CLASS_NAME : undefined}
        labelClassName={layout === "inline" ? FOLDER_SELECT_INLINE_LABEL_CLASS_NAME : undefined}
        triggerClassName={layout === "inline" ? FOLDER_SELECT_INLINE_CONTROL_CLASS_NAME : "mt-1 w-full"}
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
          className={layout === "inline" ? FOLDER_SELECT_INLINE_ROW_CLASS_NAME : undefined}
          labelClassName={layout === "inline" ? FOLDER_SELECT_INLINE_LABEL_CLASS_NAME : undefined}
          inputClassName={layout === "inline" ? FOLDER_SELECT_INLINE_CONTROL_CLASS_NAME : "mt-1"}
          disabled={disabled}
        />
      )}
    </>
  );
}
