import type { AccountGeneralSectionViewProps } from "@/components/settings/account-detail.types";
import { SettingsRow } from "@/components/settings/settings-components";
import { SettingsSection } from "@/components/settings/settings-section";
import { LabeledInputRow } from "@/components/shared/labeled-input-row";

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
}: AccountGeneralSectionViewProps) {
  const labelColumnClassName = "sm:w-24 sm:shrink-0";
  const valueColumnClassName = "sm:pl-2";

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
        onBlur={isEditingName ? onCommitName : undefined}
        onFocus={!isEditingName ? onStartEditingName : undefined}
        onKeyDown={isEditingName ? onNameKeyDown : undefined}
        rowClassName="flex-col items-stretch sm:flex-row sm:items-center sm:justify-start"
        labelClassName={labelColumnClassName}
        controlClassName="sm:min-w-0 sm:flex-1"
        inputClassName="h-auto w-full border-border bg-background px-2 py-1 text-sm sm:flex-1"
        disabled={isSavingName}
      />
      {infoRows.map((row) => (
        <SettingsRow
          key={row.label}
          label={row.label}
          labelClassName={labelColumnClassName}
          valueClassName={valueColumnClassName}
          value={row.value}
          type="text"
          truncate={row.truncate}
        />
      ))}
    </SettingsSection>
  );
}
