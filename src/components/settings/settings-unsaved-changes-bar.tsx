import { useState } from "react";
import {
  canSaveDirtySettingsEntries,
  discardDirtySettingsEntries,
  saveDirtySettingsEntries,
} from "@/components/settings/hooks/settings-dirty-state-registry";
import { useSettingsDirtyStateRegistrySnapshot } from "@/components/settings/hooks/use-settings-dirty-state-registry";
import { SettingsActionBarShell } from "@/components/settings/shared/settings-action-bar-shell";
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
    <SettingsActionBarShell testId="settings-unsaved-changes-bar" label={message} message={message}>
      <FormActionButtons
        cancelLabel={discardLabel}
        submitLabel={saveLabel}
        submittingLabel={savingLabel}
        loading={saving}
        cancelDisabled={saving}
        onCancel={onDiscard}
        onSubmit={onSave}
      />
    </SettingsActionBarShell>
  );
}

export function SettingsUnsavedChangesFooter(labels: SettingsUnsavedChangesLabels) {
  const dirtyStateSnapshot = useSettingsDirtyStateRegistrySnapshot();
  const [saving, setSaving] = useState(false);

  if (!saving && !canSaveDirtySettingsEntries(dirtyStateSnapshot)) {
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
