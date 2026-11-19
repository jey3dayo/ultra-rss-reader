import { useState } from "react";
import { SettingsLoadingActionButton } from "@/components/settings/settings-loading-action-button";
import { SettingsActionBarShell } from "@/components/settings/shared/settings-action-bar-shell";
import { FormActionButtons } from "@/design-system";

type AccountActionBarProps = {
  hasUnsavedChanges: boolean;
  running: boolean;
  disabled?: boolean;
  message: string;
  discardLabel: string;
  saveAndTestLabel: string;
  testConnectionLabel: string;
  testingLabel: string;
  savingLabel?: string;
  saving?: boolean;
  connectionVerified: boolean;
  connectionVerifiedLabel: string;
  onDiscard: () => void;
  onTestConnection: () => void;
};

function useUnsavedModeFrozenWhileRunning(hasUnsavedChanges: boolean, running: boolean): boolean {
  const [frozen, setFrozen] = useState<boolean | null>(null);

  if (running && frozen === null) {
    setFrozen(hasUnsavedChanges);
  } else if (!running && frozen !== null) {
    setFrozen(null);
  }

  return frozen ?? hasUnsavedChanges;
}

export function AccountActionBar({
  hasUnsavedChanges,
  running,
  disabled = false,
  message,
  discardLabel,
  saveAndTestLabel,
  testConnectionLabel,
  testingLabel,
  savingLabel,
  saving,
  connectionVerified,
  connectionVerifiedLabel,
  onDiscard,
  onTestConnection,
}: AccountActionBarProps) {
  const showUnsavedMode = useUnsavedModeFrozenWhileRunning(hasUnsavedChanges, running);

  if (showUnsavedMode) {
    return (
      <SettingsActionBarShell testId="account-action-bar" label={message} message={message} alignment="card-controls">
        <FormActionButtons
          cancelLabel={discardLabel}
          submitLabel={saveAndTestLabel}
          submittingLabel={saving ? savingLabel : testingLabel}
          loading={running}
          cancelDisabled={running || disabled}
          submitDisabled={disabled}
          onCancel={onDiscard}
          onSubmit={onTestConnection}
        />
      </SettingsActionBarShell>
    );
  }

  return (
    <SettingsActionBarShell testId="account-action-bar" label={testConnectionLabel} alignment="card-controls">
      <SettingsLoadingActionButton
        size="compact"
        onClick={onTestConnection}
        loading={running}
        disabled={disabled}
        loadingLabel={testingLabel}
        success={connectionVerified}
        successLabel={connectionVerifiedLabel}
      >
        {testConnectionLabel}
      </SettingsLoadingActionButton>
    </SettingsActionBarShell>
  );
}
