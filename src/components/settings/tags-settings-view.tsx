import { Pencil, Trash2 } from "lucide-react";
import { useId } from "react";
import { SettingsActionButton } from "@/components/settings/shared/settings-action-button";
import { SettingsContentLayout } from "@/components/settings/shared/settings-content-layout";
import { SettingsSection } from "@/components/settings/shared/settings-section";
import { LabeledControlRow } from "@/components/shared/labeled-control-row";
import { TagColorPicker } from "@/components/shared/tag-color-picker";
import { Input } from "@/components/ui/input";

type TagsSettingsListItem = {
  id: string;
  name: string;
  color: string | null;
};

export type TagsSettingsViewProps = {
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
  tags,
  editLabel: _editLabel,
  editAriaLabel,
  deleteLabel: _deleteLabel,
  deleteAriaLabel,
  onEdit,
  onDelete,
}: TagsSettingsViewProps) {
  const nameInputId = useId();

  return (
    <SettingsContentLayout title={title} outerTestId="tags-settings-root">
      <SettingsSection heading={addHeading} note={intro} surface="flat" className="mb-6 sm:mb-7">
        <LabeledControlRow
          label={nameLabel}
          htmlFor={nameInputId}
          className="items-start sm:items-center"
          labelClassName="sm:w-40 sm:shrink-0"
        >
          <div className="flex w-full items-center gap-2 sm:max-w-[30rem] sm:justify-end">
            <Input
              id={nameInputId}
              name="tag_name"
              value={nameValue}
              placeholder={namePlaceholder}
              onChange={(event) => onNameChange(event.target.value)}
              className="h-10 flex-1"
              aria-label={nameLabel}
            />
            <SettingsActionButton type="button" size="compact" onClick={onCreate} disabled={createDisabled}>
              {createLabel}
            </SettingsActionButton>
          </div>
        </LabeledControlRow>
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

      <SettingsSection heading={savedHeading} surface="flat">
        {tags.length === 0 ? (
          <p className="border-b border-border py-3 text-sm text-foreground-soft">{emptyState}</p>
        ) : (
          <div className="border-t border-border/70">
            {tags.map((tag) => (
              <div
                key={tag.id}
                data-testid={`tags-settings-row-${tag.id}`}
                className="motion-contextual-surface flex min-h-[44px] items-center justify-between gap-3 border-b border-border/70 py-3"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  {tag.color ? (
                    <span
                      aria-hidden="true"
                      data-testid={`tags-settings-color-dot-${tag.id}`}
                      className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: tag.color }}
                    />
                  ) : null}
                  <span className="truncate text-[14px] leading-[1.35] text-[color:var(--form-row-label)]">
                    {tag.name}
                  </span>
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  <SettingsActionButton
                    type="button"
                    size="icon"
                    tone="subtle"
                    className="size-8"
                    aria-label={editAriaLabel(tag.name)}
                    onClick={() => onEdit(tag.id)}
                  >
                    <Pencil className="h-4 w-4" />
                  </SettingsActionButton>
                  <SettingsActionButton
                    type="button"
                    size="icon"
                    tone="danger"
                    className="size-8"
                    aria-label={deleteAriaLabel(tag.name)}
                    onClick={() => onDelete(tag.id)}
                  >
                    <Trash2 className="h-4 w-4" />
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
