import type { KeyboardEvent, RefObject } from "react";
import { AccountDetailSettingsRow } from "@/components/settings/account-detail/settings-row";
import { SettingsActionButton } from "@/components/settings/shared/settings-action-button";
import { SettingsSection } from "@/components/settings/shared/settings-section";
import { SETTINGS_CONTROL_SURFACE_CLASS } from "@/components/settings/shared/settings-surface";
import { LabeledInputRow, SurfaceCard } from "@/design-system";

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
  onCancelName: () => void;
  nameDirty?: boolean;
  nameSaved?: boolean;
  saveLabel: string;
  cancelLabel: string;
  unsavedLabel: string;
  savedLabel: string;
  savingLabel: string;
  onNameKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  disabled?: boolean;
  errorMessage?: string | null;
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
  onCancelName,
  nameDirty,
  nameSaved,
  saveLabel,
  cancelLabel,
  unsavedLabel,
  savedLabel,
  savingLabel,
  onNameKeyDown,
  disabled = false,
  errorMessage,
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
        onFocus={!disabled && !isEditingName ? onStartEditingName : undefined}
        onKeyDown={!disabled && isEditingName ? onNameKeyDown : undefined}
        labelClassName={labelColumnClassName}
        inputClassName={`h-11 ${SETTINGS_CONTROL_SURFACE_CLASS}`}
        disabled={disabled || isSavingName}
      />
      {isEditingName ? (
        <div className="flex items-center justify-end gap-2">
          {nameDirty && <span role="status">{unsavedLabel}</span>}
          <SettingsActionButton size="compact" disabled={isSavingName || disabled} onClick={onCancelName}>
            {cancelLabel}
          </SettingsActionButton>
          <SettingsActionButton size="compact" disabled={isSavingName || disabled} onClick={onCommitName}>
            {isSavingName ? savingLabel : saveLabel}
          </SettingsActionButton>
        </div>
      ) : nameSaved ? (
        <p role="status" className="text-right text-sm">
          {savedLabel}
        </p>
      ) : null}
      {errorMessage ? (
        <SurfaceCard variant="info" tone="danger" padding="compact" role="alert">
          <p className="text-sm leading-[1.5]">{errorMessage}</p>
        </SurfaceCard>
      ) : null}
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
