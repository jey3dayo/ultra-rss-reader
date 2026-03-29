import type { RefObject } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "@/components/ui/select";

export type FolderSelectOption = {
  value: string;
  label: string;
};

export type FolderSelectViewProps = {
  labelId: string;
  label: string;
  value: string;
  options: FolderSelectOption[];
  disabled: boolean;
  isCreatingFolder: boolean;
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
  disabled,
  isCreatingFolder,
  newFolderLabel,
  newFolderName,
  newFolderPlaceholder,
  onValueChange,
  onNewFolderNameChange,
  newFolderInputRef,
}: FolderSelectViewProps) {
  const getFolderLabel = (selectedValue: string | null) =>
    options.find((option) => option.value === (selectedValue ?? ""))?.label ?? selectedValue ?? "";

  return (
    <>
      <div className="block text-sm text-muted-foreground">
        <span id={labelId} className="mb-1 block">
          {label}
        </span>
        <Select
          name="feed-folder"
          value={value}
          onValueChange={(nextValue) => nextValue !== null && onValueChange(nextValue)}
          disabled={disabled}
        >
          <SelectTrigger aria-labelledby={labelId} className="mt-1 w-full">
            <SelectValue>{(selectedValue: string | null) => getFolderLabel(selectedValue)}</SelectValue>
          </SelectTrigger>
          <SelectPopup>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectPopup>
        </Select>
      </div>

      {isCreatingFolder && (
        <label className="block text-sm text-muted-foreground">
          {newFolderLabel}
          <Input
            ref={newFolderInputRef}
            name="new-folder-name"
            type="text"
            value={newFolderName}
            onChange={(event) => onNewFolderNameChange(event.target.value)}
            placeholder={newFolderPlaceholder}
            className="mt-1"
            disabled={disabled}
          />
        </label>
      )}
    </>
  );
}
