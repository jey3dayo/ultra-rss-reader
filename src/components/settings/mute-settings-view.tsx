import { AlertTriangle } from "lucide-react";
import type { FormEvent } from "react";
import type { MuteKeywordScope } from "@/api/schemas";
import { SettingsActionButton } from "@/components/settings/shared/settings-action-button";
import { SettingsContentLayout } from "@/components/settings/shared/settings-content-layout";
import { SettingsSection } from "@/components/settings/shared/settings-section";
import { ConfirmDialogView } from "@/components/shared/confirm-dialog-view";
import { GradientSwitch } from "@/components/shared/gradient-switch";
import { LabeledActionInputRow } from "@/components/shared/labeled-action-input-row";
import { ActionSelectControl, LabeledActionSelectRow } from "@/components/shared/labeled-action-select-row";
import { LabeledControlRow } from "@/components/shared/labeled-control-row";
import { MOTION_CONTENT_SWAP_CLASS_NAME, MOTION_DATA_PHASE_ATTRIBUTE, MOTION_PHASE_ENTERING } from "@/constants/motion";
import { logRuntimeDiagnostic } from "@/lib/runtime/diagnostics";

type MuteSettingsScopeOption = {
  value: MuteKeywordScope;
  label: string;
};

function isMuteKeywordScope(value: string | null): value is MuteKeywordScope {
  return value === "title" || value === "body" || value === "title_and_body";
}

export function handleMuteKeywordScopeSelectValue(
  value: string | null,
  onValidScopeChange: (scope: MuteKeywordScope) => void,
  context: { source: "add-row" | "saved-rule"; ruleId?: string },
) {
  if (isMuteKeywordScope(value)) {
    onValidScopeChange(value);
    return;
  }

  logRuntimeDiagnostic("mute-keyword-scope-select", "Ignored invalid mute keyword scope select value", {
    source: context.source,
    ruleId: context.ruleId,
    value,
  });
}

type MuteSettingsKeywordRow = {
  id: string;
  keyword: string;
  scope: MuteKeywordScope;
};

export type MuteSettingsViewProps = {
  title: string;
  addHeading: string;
  intro: string;
  keywordLabel: string;
  keywordValue: string;
  keywordPlaceholder: string;
  scopeAriaLabel: string;
  scopeValue: MuteKeywordScope;
  scopeOptions: MuteSettingsScopeOption[];
  addLabel: string;
  onKeywordChange: (value: string) => void;
  onScopeChange: (value: MuteKeywordScope) => void;
  onAdd: () => void;
  addDisabled: boolean;
  savedHeading: string;
  emptyState: string;
  rules: MuteSettingsKeywordRow[];
  savedScopeAriaLabel: (keyword: string) => string;
  onRuleScopeChange: (ruleId: string, scope: MuteKeywordScope) => void;
  deleteLabel: string;
  onRequestDelete: (ruleId: string) => void;
  autoMarkReadHeading: string;
  autoMarkReadLabel: string;
  autoMarkReadChecked: boolean;
  autoMarkReadDisabled: boolean;
  autoMarkReadHint: string;
  onAutoMarkReadChange: (checked: boolean) => void;
  confirmOpen: boolean;
  confirmMessage: string;
  confirmActionLabel: string;
  confirmPending?: boolean;
  cancelLabel: string;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
};

export function MuteSettingsView({
  title,
  addHeading,
  intro,
  keywordLabel,
  keywordValue,
  keywordPlaceholder,
  scopeAriaLabel,
  scopeValue,
  scopeOptions,
  addLabel,
  onKeywordChange,
  onScopeChange,
  onAdd,
  addDisabled,
  savedHeading,
  emptyState,
  rules,
  savedScopeAriaLabel,
  onRuleScopeChange,
  deleteLabel,
  onRequestDelete,
  autoMarkReadHeading,
  autoMarkReadLabel,
  autoMarkReadChecked,
  autoMarkReadDisabled,
  autoMarkReadHint,
  onAutoMarkReadChange,
  confirmOpen,
  confirmMessage,
  confirmActionLabel,
  confirmPending = false,
  cancelLabel,
  onConfirmDelete,
  onCancelDelete,
}: MuteSettingsViewProps) {
  const handleAddSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!addDisabled) {
      onAdd();
    }
  };

  return (
    <>
      <SettingsContentLayout title={title} outerTestId="mute-settings-root">
        <SettingsSection heading={addHeading} note={intro} surface="flat" className="mb-6 sm:mb-7">
          <LabeledActionInputRow
            label={keywordLabel}
            name="mute_keyword"
            value={keywordValue}
            onChange={onKeywordChange}
            placeholder={keywordPlaceholder}
            rowClassName="items-start sm:items-center"
            labelClassName="sm:w-40 sm:shrink-0"
            controlClassName="flex-col sm:w-auto sm:min-w-[30rem] sm:flex-row"
            inputClassName="w-full sm:w-[220px] sm:flex-none"
            formProps={{
              "data-testid": "mute-settings-add-row",
              onSubmit: handleAddSubmit,
            }}
            trailingControls={
              <>
                <ActionSelectControl
                  label={scopeAriaLabel}
                  name="mute_keyword_scope"
                  value={scopeValue}
                  options={scopeOptions}
                  onValueChange={(value) =>
                    handleMuteKeywordScopeSelectValue(value, onScopeChange, {
                      source: "add-row",
                    })
                  }
                  triggerClassName="h-10 w-full sm:w-[192px] sm:flex-none"
                />
                <SettingsActionButton type="submit" size="compact" disabled={addDisabled}>
                  {addLabel}
                </SettingsActionButton>
              </>
            }
          />
        </SettingsSection>

        <SettingsSection heading={autoMarkReadHeading} note={autoMarkReadHint} surface="flat" className="mb-6 sm:mb-7">
          <LabeledControlRow label={autoMarkReadLabel}>
            <GradientSwitch
              checked={autoMarkReadChecked}
              disabled={autoMarkReadDisabled}
              aria-label={autoMarkReadLabel}
              onCheckedChange={onAutoMarkReadChange}
            />
          </LabeledControlRow>
        </SettingsSection>

        <SettingsSection heading={savedHeading} surface="flat">
          {rules.length === 0 ? (
            <p
              {...{ [MOTION_DATA_PHASE_ATTRIBUTE]: MOTION_PHASE_ENTERING }}
              className={`${MOTION_CONTENT_SWAP_CLASS_NAME} border-b border-border py-3 text-sm text-foreground-soft`}
            >
              {emptyState}
            </p>
          ) : (
            rules.map((rule) => (
              <LabeledActionSelectRow
                key={rule.id}
                label={rule.keyword}
                value={rule.scope}
                options={scopeOptions}
                selectAriaLabel={savedScopeAriaLabel(rule.keyword)}
                onValueChange={(value) =>
                  handleMuteKeywordScopeSelectValue(value, (scope) => onRuleScopeChange(rule.id, scope), {
                    source: "saved-rule",
                    ruleId: rule.id,
                  })
                }
                labelClassName="sm:max-w-[280px] sm:shrink-0 sm:truncate"
                triggerClassName="h-10 w-full sm:flex-1"
                trailingControls={
                  <SettingsActionButton type="button" size="compact" onClick={() => onRequestDelete(rule.id)}>
                    {deleteLabel}
                  </SettingsActionButton>
                }
              />
            ))
          )}
        </SettingsSection>
      </SettingsContentLayout>

      <ConfirmDialogView
        open={confirmOpen}
        title={confirmActionLabel}
        message={confirmMessage}
        actionLabel={confirmActionLabel}
        cancelLabel={cancelLabel}
        icon={AlertTriangle}
        confirmDisabled={confirmPending}
        cancelDisabled={confirmPending}
        onOpenChange={(open) => !open && onCancelDelete()}
        onConfirm={onConfirmDelete}
        onCancel={onCancelDelete}
      />
    </>
  );
}
