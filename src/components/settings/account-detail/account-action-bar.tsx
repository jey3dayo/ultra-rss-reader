import { useState } from "react";
import { SettingsLoadingActionButton } from "@/components/settings/settings-loading-action-button";
import { SettingsActionBarShell } from "@/components/settings/shared/settings-action-bar-shell";
import { FormActionButtons } from "@/design-system";

type AccountActionBarProps = {
  hasUnsavedChanges: boolean;
  running: boolean;
  message: string;
  discardLabel: string;
  saveAndTestLabel: string;
  testConnectionLabel: string;
  testingLabel: string;
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
  message,
  discardLabel,
  saveAndTestLabel,
  testConnectionLabel,
  testingLabel,
  connectionVerified,
  connectionVerifiedLabel,
  onDiscard,
  onTestConnection,
}: AccountActionBarProps) {
  const showUnsavedMode = useUnsavedModeFrozenWhileRunning(hasUnsavedChanges, running);

  if (showUnsavedMode) {
    return (
      <SettingsActionBarShell testId="account-action-bar" label={message} message={message}>
        <FormActionButtons
          cancelLabel={discardLabel}
          submitLabel={saveAndTestLabel}
          submittingLabel={testingLabel}
          loading={running}
          cancelDisabled={running}
          onCancel={onDiscard}
          onSubmit={onTestConnection}
        />
      </SettingsActionBarShell>
    );
  }

  return (
    <SettingsActionBarShell testId="account-action-bar" label={testConnectionLabel}>
      <SettingsLoadingActionButton
        size="compact"
        onClick={onTestConnection}
        loading={running}
        loadingLabel={testingLabel}
        success={connectionVerified}
        successLabel={connectionVerifiedLabel}
      >
        {testConnectionLabel}
      </SettingsLoadingActionButton>
    </SettingsActionBarShell>
  );
}
