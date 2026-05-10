import { AlertTriangle } from "lucide-react";
import type { FormEvent } from "react";
import type { MuteKeywordScope } from "@/api/schemas";
import { SettingsActionButton } from "@/components/settings/shared/settings-action-button";
import { SettingsContentLayout } from "@/components/settings/shared/settings-content-layout";
import { SettingsSection } from "@/components/settings/shared/settings-section";
import { ConfirmDialogView } from "@/components/shared/confirm-dialog-view";
import { GradientSwitch } from "@/components/shared/gradient-switch";
import { LabeledControlRow } from "@/components/shared/labeled-control-row";
import { Input } from "@/components/ui/input";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MOTION_CONTENT_SWAP_CLASS_NAME, MOTION_DATA_PHASE_ATTRIBUTE, MOTION_PHASE_ENTERING } from "@/constants/motion";
import { logRuntimeDiagnostic } from "@/lib/runtime/diagnostics";
import { getOptionLabelByValue } from "@/lib/ui/options";

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
          <LabeledControlRow
            label={keywordLabel}
            className="items-start sm:items-center"
            labelClassName="sm:w-40 sm:shrink-0"
          >
            <form
              data-testid="mute-settings-add-row"
              className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-[30rem] sm:max-w-[30rem] sm:flex-row sm:items-center sm:justify-end"
              onSubmit={handleAddSubmit}
            >
              <Input
                name="mute_keyword"
                aria-label={keywordLabel}
                value={keywordValue}
                onChange={(event) => onKeywordChange(event.target.value)}
                placeholder={keywordPlaceholder}
                className="h-10 w-full sm:w-[220px] sm:flex-none"
              />
              <Select
                value={scopeValue}
                onValueChange={(value) =>
                  handleMuteKeywordScopeSelectValue(value, onScopeChange, {
                    source: "add-row",
                  })
                }
              >
                <SelectTrigger aria-label={scopeAriaLabel} className="h-10 w-full sm:w-[192px]">
                  <SelectValue>
                    {(selectedValue: string | null) => getOptionLabelByValue(scopeOptions, selectedValue ?? scopeValue)}
                  </SelectValue>
                </SelectTrigger>
                <SelectPopup>
                  {scopeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectPopup>
              </Select>
              <SettingsActionButton type="submit" size="compact" disabled={addDisabled}>
                {addLabel}
              </SettingsActionButton>
            </form>
          </LabeledControlRow>
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
              <LabeledControlRow
                key={rule.id}
                label={rule.keyword}
                labelClassName="sm:max-w-[280px] sm:shrink-0 sm:truncate"
              >
                <div className="flex w-full flex-col gap-2 sm:max-w-[30rem] sm:flex-row sm:items-center sm:justify-end">
                  <Select
                    value={rule.scope}
                    onValueChange={(value) =>
                      handleMuteKeywordScopeSelectValue(value, (scope) => onRuleScopeChange(rule.id, scope), {
                        source: "saved-rule",
                        ruleId: rule.id,
                      })
                    }
                  >
                    <SelectTrigger aria-label={savedScopeAriaLabel(rule.keyword)} className="h-10 w-full sm:flex-1">
                      <SelectValue>
                        {(selectedValue: string | null) =>
                          getOptionLabelByValue(scopeOptions, selectedValue ?? rule.scope)
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectPopup>
                      {scopeOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectPopup>
                  </Select>
                  <SettingsActionButton type="button" size="compact" onClick={() => onRequestDelete(rule.id)}>
                    {deleteLabel}
                  </SettingsActionButton>
                </div>
              </LabeledControlRow>
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
