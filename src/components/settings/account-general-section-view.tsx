import type { AccountGeneralSectionViewProps } from "@/components/settings/account-detail.types";
import { SettingsRow } from "@/components/settings/settings-components";
import { LabeledControlRow } from "@/components/shared/labeled-control-row";
import { SectionHeading } from "@/components/shared/section-heading";
import { Input } from "@/components/ui/input";

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
  return (
    <section className="mb-6">
      <SectionHeading>{heading}</SectionHeading>
      <LabeledControlRow label={nameLabel} className="flex-col items-stretch sm:flex-row sm:items-center">
        {isEditingName ? (
          <Input
            ref={nameInputRef}
            type="text"
            value={nameDraft}
            onChange={(event) => onNameDraftChange(event.target.value)}
            onBlur={onCommitName}
            onKeyDown={onNameKeyDown}
            disabled={isSavingName}
            className="h-auto w-full border-border bg-background px-2 py-1 text-left text-sm text-muted-foreground sm:w-auto sm:text-right"
          />
        ) : (
          <button
            type="button"
            onClick={onStartEditingName}
            disabled={isSavingName}
            className="cursor-pointer rounded-md border border-transparent px-2 py-1 text-sm text-muted-foreground hover:border-border hover:text-foreground"
            title={editNameTitle}
          >
            {nameValue}
          </button>
        )}
      </LabeledControlRow>
      {infoRows.map((row) => (
        <SettingsRow key={row.label} label={row.label} value={row.value} type="text" truncate={row.truncate} />
      ))}
    </section>
  );
}
