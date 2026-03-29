import type { KeyboardEvent, RefObject } from "react";
import { SectionHeading, SettingsRow } from "@/components/settings/settings-components";
import { Input } from "@/components/ui/input";

export type AccountGeneralInfoRow = {
  label: string;
  value: string;
  truncate?: boolean;
};

export type AccountGeneralSectionViewProps = {
  heading: string;
  nameLabel: string;
  nameValue: string;
  editNameTitle: string;
  isEditingName: boolean;
  nameDraft: string;
  infoRows: AccountGeneralInfoRow[];
  nameInputRef?: RefObject<HTMLInputElement | null>;
  onStartEditingName: () => void;
  onNameDraftChange: (value: string) => void;
  onCommitName: () => void;
  onNameKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
};

export function AccountGeneralSectionView({
  heading,
  nameLabel,
  nameValue,
  editNameTitle,
  isEditingName,
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
      <div className="flex min-h-[44px] items-center justify-between border-b border-border py-3">
        <span className="text-sm text-foreground">{nameLabel}</span>
        {isEditingName ? (
          <Input
            ref={nameInputRef}
            type="text"
            value={nameDraft}
            onChange={(event) => onNameDraftChange(event.target.value)}
            onBlur={onCommitName}
            onKeyDown={onNameKeyDown}
            className="h-auto w-auto border-border bg-background px-2 py-1 text-right text-sm text-muted-foreground"
          />
        ) : (
          <button
            type="button"
            onClick={onStartEditingName}
            className="cursor-pointer rounded-md border border-transparent px-2 py-1 text-sm text-muted-foreground hover:border-border hover:text-foreground"
            title={editNameTitle}
          >
            {nameValue}
          </button>
        )}
      </div>
      {infoRows.map((row) => (
        <SettingsRow key={row.label} label={row.label} value={row.value} type="text" truncate={row.truncate} />
      ))}
    </section>
  );
}
