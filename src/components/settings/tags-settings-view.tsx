import { Pencil, Trash2 } from "lucide-react";
import { SettingsActionButton } from "@/components/settings/settings-action-button";
import { SettingsContentLayout } from "@/components/settings/settings-content-layout";
import { SettingsSection } from "@/components/settings/settings-section";
import { LabeledControlRow } from "@/components/shared/labeled-control-row";
import { TagColorPicker } from "@/components/shared/tag-color-picker";
import { Input } from "@/components/ui/input";

export type TagsSettingsListItem = {
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
  return (
    <SettingsContentLayout title={title} outerTestId="tags-settings-root">
      <SettingsSection heading={addHeading} note={intro} surface="flat" className="mb-6 sm:mb-7">
        <LabeledControlRow
          label={nameLabel}
          className="items-start sm:items-center"
          labelClassName="sm:w-40 sm:shrink-0"
        >
          <div className="flex w-full items-center gap-2 sm:max-w-[30rem] sm:justify-end">
            <Input
              name="tag_name"
              aria-label={nameLabel}
              value={nameValue}
              placeholder={namePlaceholder}
              onChange={(event) => onNameChange(event.target.value)}
              className="h-10 flex-1"
            />
            <SettingsActionButton size="compact" onClick={onCreate} disabled={createDisabled} aria-label={createLabel}>
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
          tags.map((tag) => (
            <LabeledControlRow key={tag.id} label={tag.name} labelClassName="sm:max-w-[280px] sm:shrink-0 sm:truncate">
              <div className="flex w-full flex-col gap-2 sm:max-w-[30rem] sm:flex-row sm:items-center sm:justify-end">
                {tag.color ? (
                  <span
                    aria-hidden="true"
                    data-testid={`tags-settings-swatch-${tag.id}`}
                    className="inline-block h-8 w-8 shrink-0 rounded-full border border-border/70 sm:mr-1"
                    style={{ backgroundColor: tag.color }}
                  />
                ) : null}
                <SettingsActionButton
                  type="button"
                  size="icon"
                  tone="subtle"
                  aria-label={editAriaLabel(tag.name)}
                  onClick={() => onEdit(tag.id)}
                >
                  <Pencil className="h-4 w-4" />
                </SettingsActionButton>
                <SettingsActionButton
                  type="button"
                  size="icon"
                  tone="danger"
                  aria-label={deleteAriaLabel(tag.name)}
                  onClick={() => onDelete(tag.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </SettingsActionButton>
              </div>
            </LabeledControlRow>
          ))
        )}
      </SettingsSection>
    </SettingsContentLayout>
  );
}
