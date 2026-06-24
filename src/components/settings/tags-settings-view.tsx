import { Pencil, Trash2 } from "lucide-react";
import { type FormEvent, useId } from "react";
import { SettingsActionButton } from "@/components/settings/shared/settings-action-button";
import { SettingsContentLayout } from "@/components/settings/shared/settings-content-layout";
import { SettingsSection } from "@/components/settings/shared/settings-section";
import { SETTINGS_CONTROL_SURFACE_CLASS, SETTINGS_DIVIDER_CLASS } from "@/components/settings/shared/settings-surface";
import { LabeledActionInputRow, LabeledControlRow, TagColorPicker } from "@/design-system";
import type { TagViewItem } from "@/lib/tags.types";
import { cn } from "@/lib/utils";

type TagsSettingsListItem = TagViewItem;

type TagsSettingsViewProps = {
  title: string;
  addHeading: string;
  intro: string;
  nameLabel: string;
  nameValue: string;
  namePlaceholder: string;
  colorLabel: string;
  colorValue: string | null;
  colorOptions: readonly string[];
  noColorLabel: string;
  colorOptionAriaLabel: (color: string) => string;
  createLabel: string;
  onNameChange: (value: string) => void;
  onColorChange: (value: string | null) => void;
  onCreate: () => void;
  createDisabled: boolean;
  savedHeading: string;
  emptyState: string;
  loadFailureState?: string | null;
  tags: TagsSettingsListItem[];
  editLabel: string;
  editAriaLabel: (name: string) => string;
  deleteLabel: string;
  deleteAriaLabel: (name: string) => string;
  onEdit: (tagId: string) => void;
  onDelete: (tagId: string) => void;
};

export function TagsSettingsView({
  title,
  addHeading,
  intro,
  nameLabel,
  nameValue,
  namePlaceholder,
  colorLabel,
  colorValue,
  colorOptions,
  noColorLabel,
  colorOptionAriaLabel,
  createLabel,
  onNameChange,
  onColorChange,
  onCreate,
  createDisabled,
  savedHeading,
  emptyState,
  loadFailureState,
  tags,
  editLabel: _editLabel,
  editAriaLabel,
  deleteLabel: _deleteLabel,
  deleteAriaLabel,
  onEdit,
  onDelete,
}: TagsSettingsViewProps) {
  const nameInputId = useId();

  const handleCreateSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!createDisabled) {
      onCreate();
    }
  };

  return (
    <SettingsContentLayout title={title} outerTestId="tags-settings-root">
      <form onSubmit={handleCreateSubmit}>
        <SettingsSection heading={addHeading} note={intro} surface="flat" className="mb-6 sm:mb-7">
          <LabeledActionInputRow
            label={nameLabel}
            inputId={nameInputId}
            name="tag_name"
            value={nameValue}
            placeholder={namePlaceholder}
            onChange={onNameChange}
            rowClassName="items-start sm:items-center"
            labelClassName="sm:w-40 sm:shrink-0"
            inputClassName={SETTINGS_CONTROL_SURFACE_CLASS}
            trailingControls={
              <SettingsActionButton type="submit" size="compact" disabled={createDisabled}>
                {createLabel}
              </SettingsActionButton>
            }
          />
          <LabeledControlRow label={colorLabel} labelClassName="sm:w-40 sm:shrink-0">
            <div className="w-full sm:max-w-[400px]">
              <TagColorPicker
                color={colorValue}
                colorOptions={colorOptions}
                noColorLabel={noColorLabel}
                optionAriaLabel={colorOptionAriaLabel}
                onChange={onColorChange}
              />
            </div>
          </LabeledControlRow>
        </SettingsSection>
      </form>

      <SettingsSection heading={savedHeading} surface="flat">
        {loadFailureState ? (
          <p
            className={cn("border-b py-3 text-sm text-foreground-soft", SETTINGS_DIVIDER_CLASS)}
            data-tags-settings-state="error"
          >
            {loadFailureState}
          </p>
        ) : tags.length === 0 ? (
          <p className={cn("border-b py-3 text-sm text-foreground-soft", SETTINGS_DIVIDER_CLASS)}>{emptyState}</p>
        ) : (
          <div className={cn("border-t", SETTINGS_DIVIDER_CLASS)}>
            {tags.map((tag) => (
              <div
                key={tag.id}
                data-testid={`tags-settings-row-${tag.id}`}
                className={cn(
                  "motion-contextual-surface flex min-h-[44px] items-center justify-between gap-3 border-b py-3",
                  SETTINGS_DIVIDER_CLASS,
                )}
              >
                <div className="flex min-w-0 flex-1 items-center gap-2.5">
                  {tag.color ? (
                    <span
                      aria-hidden="true"
                      data-testid={`tags-settings-color-dot-${tag.id}`}
                      className="inline-block size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: tag.color }}
                    />
                  ) : null}
                  <span
                    className="max-w-full truncate text-[14px] leading-[1.35] text-[color:var(--form-row-label)]"
                    dir="auto"
                    title={tag.name}
                  >
                    {tag.name}
                  </span>
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  <SettingsActionButton
                    type="button"
                    size="icon"
                    tone="subtle"
                    className="size-11"
                    aria-label={editAriaLabel(tag.name)}
                    onClick={() => onEdit(tag.id)}
                  >
                    <Pencil className="size-4" />
                  </SettingsActionButton>
                  <SettingsActionButton
                    type="button"
                    size="icon"
                    tone="danger"
                    className="size-11"
                    aria-label={deleteAriaLabel(tag.name)}
                    onClick={() => onDelete(tag.id)}
                  >
                    <Trash2 className="size-4" />
                  </SettingsActionButton>
                </div>
              </div>
            ))}
          </div>
        )}
      </SettingsSection>
    </SettingsContentLayout>
  );
}
