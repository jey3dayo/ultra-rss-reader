import type { KeyboardEvent, RefObject } from "react";
import { AccountDetailSettingsRow } from "@/components/settings/account-detail/settings-row";
import { SettingsSection } from "@/components/settings/shared/settings-section";
import { LabeledInputRow } from "@/design-system";

type AccountGeneralInfoRow = {
  label: string;
  value: string;
  truncate?: boolean;
};

type AccountGeneralSectionViewProps = {
  heading: string;
  nameLabel: string;
  nameValue: string;
  editNameTitle: string;
  isEditingName: boolean;
  isSavingName?: boolean;
  nameDraft: string;
  infoRows: AccountGeneralInfoRow[];
  nameInputRef?: RefObject<HTMLInputElement | null>;
  onStartEditingName: () => void;
  onNameDraftChange: (value: string) => void;
  onCommitName: () => void;
  onNameKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  disabled?: boolean;
};

export function AccountGeneralSectionView({
  heading,
  nameLabel,
  nameValue,
  editNameTitle,
  isEditingName,
  isSavingName = false,
  nameDraft,
  infoRows,
  nameInputRef,
  onStartEditingName,
  onNameDraftChange,
  onCommitName,
  onNameKeyDown,
  disabled = false,
}: AccountGeneralSectionViewProps) {
  const labelColumnClassName = "sm:w-40 sm:shrink-0";

  return (
    <SettingsSection heading={heading} surface="flat" className="mb-6 sm:mb-7">
      <LabeledInputRow
        label={nameLabel}
        type="text"
        value={isEditingName ? nameDraft : nameValue}
        readOnly={!isEditingName}
        title={editNameTitle}
        inputRef={nameInputRef}
        onChange={onNameDraftChange}
        onBlur={!disabled && isEditingName ? onCommitName : undefined}
        onFocus={!disabled && !isEditingName ? onStartEditingName : undefined}
        onKeyDown={!disabled && isEditingName ? onNameKeyDown : undefined}
        labelClassName={labelColumnClassName}
        inputClassName="h-11"
        disabled={disabled || isSavingName}
      />
      {infoRows.map((row) => (
        <AccountDetailSettingsRow
          key={row.label}
          label={row.label}
          labelClassName={labelColumnClassName}
          value={row.value}
          type="text"
          truncate={row.truncate}
        />
      ))}
    </SettingsSection>
  );
}
