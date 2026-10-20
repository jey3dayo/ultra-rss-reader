import { cn } from "cn";
import { useState } from "react";
import {
  discardDirtySettingsEntries,
  saveDirtySettingsEntries,
} from "@/components/settings/hooks/settings-dirty-state-registry";
import { useSettingsDirtyStateRegistrySnapshot } from "@/components/settings/hooks/use-settings-dirty-state-registry";
import { SETTINGS_DIVIDER_CLASS } from "@/components/settings/shared/settings-surface";
import { FormActionButtons } from "@/design-system";

type SettingsUnsavedChangesLabels = {
  message: string;
  discardLabel: string;
  saveLabel: string;
  savingLabel: string;
};

type SettingsUnsavedChangesBarProps = SettingsUnsavedChangesLabels & {
  saving: boolean;
  onDiscard: () => void;
  onSave: () => void;
};

export function SettingsUnsavedChangesBar({
  message,
  discardLabel,
  saveLabel,
  savingLabel,
  saving,
  onDiscard,
  onSave,
}: SettingsUnsavedChangesBarProps) {
  return (
    <section
      data-testid="settings-unsaved-changes-bar"
      aria-label={message}
      className={cn(
        "flex shrink-0 flex-col gap-3 border-t px-5 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-8",
        SETTINGS_DIVIDER_CLASS,
      )}
      style={{ backgroundColor: "var(--settings-shell-content)" }}
    >
      <p role="status" className="flex min-w-0 items-center gap-2 text-sm font-medium text-foreground">
        <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-[var(--settings-field-changed-border)]" />
        {message}
      </p>
      <div className="sm:w-auto">
        <FormActionButtons
          cancelLabel={discardLabel}
          submitLabel={saveLabel}
          submittingLabel={savingLabel}
          loading={saving}
          cancelDisabled={saving}
          onCancel={onDiscard}
          onSubmit={onSave}
        />
      </div>
    </section>
  );
}

export function SettingsUnsavedChangesFooter(labels: SettingsUnsavedChangesLabels) {
  const dirtyStateSnapshot = useSettingsDirtyStateRegistrySnapshot();
  const [saving, setSaving] = useState(false);

  if (!dirtyStateSnapshot.dirty && !saving) {
    return null;
  }

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveDirtySettingsEntries(dirtyStateSnapshot);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SettingsUnsavedChangesBar
      {...labels}
      saving={saving || dirtyStateSnapshot.pending}
      onDiscard={() => discardDirtySettingsEntries(dirtyStateSnapshot)}
      onSave={() => void handleSave()}
    />
  );
}
