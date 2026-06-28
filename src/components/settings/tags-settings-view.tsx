import { Pencil, Trash2 } from "lucide-react";
import { type FormEvent, useId } from "react";
import { SettingsActionButton } from "@/components/settings/shared/settings-action-button";
import { SettingsContentLayout } from "@/components/settings/shared/settings-content-layout";
import { SettingsSection } from "@/components/settings/shared/settings-section";
import { SETTINGS_CONTROL_SURFACE_CLASS, SETTINGS_DIVIDER_CLASS } from "@/components/settings/shared/settings-surface";
import { Input, TagColorPicker } from "@/design-system";
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
    <SettingsContentLayout title={title} titleLayout="stacked-left" outerTestId="tags-settings-root">
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] md:items-start">
        <form onSubmit={handleCreateSubmit}>
          <SettingsSection
            heading={addHeading}
            note={intro}
            surface="flat"
            className="px-3 py-2.5 sm:px-4 sm:py-3"
            headingClassName="mb-2"
            contentClassName="space-y-3"
          >
            <div className="space-y-1.5">
              <label htmlFor={nameInputId} className="block text-[12px] font-medium text-[color:var(--form-row-label)]">
                {nameLabel}
              </label>
              <div className="flex min-w-0 gap-2">
                <Input
                  id={nameInputId}
                  name="tag_name"
                  value={nameValue}
                  placeholder={namePlaceholder}
                  onChange={(event) => onNameChange(event.currentTarget.value)}
                  className={cn("h-9 flex-1", SETTINGS_CONTROL_SURFACE_CLASS)}
                />
                <SettingsActionButton type="submit" size="compact" className="h-9 min-h-9" disabled={createDisabled}>
                  {createLabel}
                </SettingsActionButton>
              </div>
            </div>

            <div className="space-y-1.5">
              <span className="block text-[12px] font-medium text-[color:var(--form-row-label)]">{colorLabel}</span>
              <TagColorPicker
                color={colorValue}
                colorOptions={colorOptions}
                noColorLabel={noColorLabel}
                optionAriaLabel={colorOptionAriaLabel}
                density="compact"
                showNoColorOption={false}
                onChange={onColorChange}
              />
            </div>
          </SettingsSection>
        </form>

        <SettingsSection
          heading={savedHeading}
          surface="flat"
          className="px-3 py-2.5 sm:px-4 sm:py-3"
          headingClassName="mb-2"
          contentClassName="[&>*:first-child]:pt-0 [&>*:last-child]:pb-0"
        >
          {loadFailureState ? (
            <p
              className={cn("border-b py-2 text-sm text-foreground-soft", SETTINGS_DIVIDER_CLASS)}
              data-tags-settings-state="error"
            >
              {loadFailureState}
            </p>
          ) : tags.length === 0 ? (
            <p className={cn("border-b py-2 text-sm text-foreground-soft", SETTINGS_DIVIDER_CLASS)}>{emptyState}</p>
          ) : (
            <div>
              {tags.map((tag) => (
                <div
                  key={tag.id}
                  data-testid={`tags-settings-row-${tag.id}`}
                  className={cn(
                    "motion-contextual-surface flex min-h-10 items-center justify-between gap-3 border-b py-1.5",
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
                      className="max-w-full truncate text-[13px] leading-[1.35] text-[color:var(--form-row-label)]"
                      dir="auto"
                      title={tag.name}
                    >
                      {tag.name}
                    </span>
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    <SettingsActionButton
                      type="button"
                      size="icon"
                      tone="subtle"
                      className="size-8 min-h-8 min-w-8"
                      aria-label={editAriaLabel(tag.name)}
                      onClick={() => onEdit(tag.id)}
                    >
                      <Pencil className="size-3.5" />
                    </SettingsActionButton>
                    <SettingsActionButton
                      type="button"
                      size="icon"
                      tone="danger"
                      className="size-8 min-h-8 min-w-8"
                      aria-label={deleteAriaLabel(tag.name)}
                      onClick={() => onDelete(tag.id)}
                    >
                      <Trash2 className="size-3.5" />
                    </SettingsActionButton>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SettingsSection>
      </div>
    </SettingsContentLayout>
  );
}
