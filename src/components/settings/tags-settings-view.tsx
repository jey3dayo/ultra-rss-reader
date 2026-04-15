import { SettingsContentLayout } from "@/components/settings/settings-content-layout";
import { SettingsSection } from "@/components/settings/settings-section";
import { TagColorPicker } from "@/components/shared/tag-color-picker";
import { Button } from "@/components/ui/button";
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
  editLabel,
  editAriaLabel,
  deleteLabel,
  deleteAriaLabel,
  onEdit,
  onDelete,
}: TagsSettingsViewProps) {
  return (
    <SettingsContentLayout title={title} outerTestId="tags-settings-root">
      <SettingsSection heading={addHeading} note={intro} className="mb-6">
        <div className="mx-auto w-full max-w-xl rounded-xl border border-border/70 bg-background/35 p-4 sm:p-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="tags-settings-name" className="block text-sm font-medium text-foreground/88">
                {nameLabel}
              </label>
              <Input
                id="tags-settings-name"
                name="tag_name"
                aria-label={nameLabel}
                value={nameValue}
                onChange={(event) => onNameChange(event.target.value)}
                placeholder={namePlaceholder}
                className="h-11 rounded-lg border-border/80 bg-background/80 px-3 shadow-none"
              />
            </div>

            <div className="rounded-lg border border-border/70 bg-background/55 p-3 sm:p-4">
              <TagColorPicker
                label={colorLabel}
                color={colorValue}
                colorOptions={colorOptions}
                noColorLabel={noColorLabel}
                optionAriaLabel={colorOptionAriaLabel}
                onChange={onColorChange}
              />
            </div>

            <Button
              type="button"
              className="h-11 w-full rounded-lg text-sm font-medium"
              onClick={onCreate}
              disabled={createDisabled}
            >
              {createLabel}
            </Button>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection heading={savedHeading}>
        {tags.length === 0 ? (
          <p className="border-b border-border py-3 text-sm text-muted-foreground">{emptyState}</p>
        ) : (
          tags.map((tag) => (
            <LabeledControlRow
              key={tag.id}
              label={
                <span className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="inline-block h-2.5 w-2.5 rounded-full border border-border/70"
                    style={{ backgroundColor: tag.color ?? "transparent" }}
                  />
                  <span className="truncate">{tag.name}</span>
                </span>
              }
              labelClassName="sm:max-w-[280px] sm:shrink-0 sm:truncate"
            >
              <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-label={editAriaLabel(tag.name)}
                  onClick={() => onEdit(tag.id)}
                >
                  {editLabel}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-label={deleteAriaLabel(tag.name)}
                  onClick={() => onDelete(tag.id)}
                >
                  {deleteLabel}
                </Button>
              </div>
            </LabeledControlRow>
          ))
        )}
      </SettingsSection>
    </SettingsContentLayout>
  );
}
