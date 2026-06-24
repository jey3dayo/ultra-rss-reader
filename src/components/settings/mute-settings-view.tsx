import { AlertTriangle, Trash2 } from "lucide-react";
import type { FormEvent } from "react";
import type { MuteKeywordScope } from "@/api/schemas";
import { SettingsLoadingActionButton } from "@/components/settings/settings-loading-action-button";
import { SettingsActionButton } from "@/components/settings/shared/settings-action-button";
import { SettingsContentLayout } from "@/components/settings/shared/settings-content-layout";
import { SettingsSection } from "@/components/settings/shared/settings-section";
import { SETTINGS_CONTROL_SURFACE_CLASS, SETTINGS_DIVIDER_CLASS } from "@/components/settings/shared/settings-surface";
import { MOTION_CONTENT_SWAP_CLASS_NAME, MOTION_DATA_PHASE_ATTRIBUTE, MOTION_PHASE_ENTERING } from "@/constants/motion";
import {
  ActionSelectControl,
  ConfirmDialogView,
  GradientSwitch,
  LabeledActionInputRow,
  LabeledActionSelectRow,
  LabeledControlRow,
} from "@/design-system";
import { cn } from "@/lib/utils";
import { handleMuteKeywordScopeSelectValue } from "./mute-keyword-scope-select";

type MuteSettingsScopeOption = {
  value: MuteKeywordScope;
  label: string;
};

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
  addPendingLabel?: string;
  onKeywordChange: (value: string) => void;
  onScopeChange: (value: MuteKeywordScope) => void;
  onAdd: () => void;
  addDisabled: boolean;
  addPending?: boolean;
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
  addPendingLabel,
  onKeywordChange,
  onScopeChange,
  onAdd,
  addDisabled,
  addPending = false,
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
    if (!addDisabled && !addPending) {
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
            controlClassName="grid min-w-0 gap-2 sm:w-full sm:max-w-[30rem] sm:grid-cols-[minmax(0,1fr)_auto]"
            inputClassName={cn("w-full min-w-0 sm:col-span-2", SETTINGS_CONTROL_SURFACE_CLASS)}
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
                  triggerClassName={cn("h-11 w-full min-w-0 sm:w-[192px] sm:flex-none", SETTINGS_CONTROL_SURFACE_CLASS)}
                />
                <SettingsLoadingActionButton
                  type="submit"
                  size="compact"
                  disabled={addDisabled}
                  loading={addPending}
                  loadingLabel={addPendingLabel}
                >
                  {addLabel}
                </SettingsLoadingActionButton>
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
              className={cn(
                MOTION_CONTENT_SWAP_CLASS_NAME,
                "border-b py-3 text-sm text-foreground-soft",
                SETTINGS_DIVIDER_CLASS,
              )}
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
                labelClassName="break-all sm:max-w-[280px] sm:shrink-0 sm:truncate sm:break-normal"
                triggerClassName={cn("h-11 w-full sm:flex-1", SETTINGS_CONTROL_SURFACE_CLASS)}
                trailingControls={
                  <SettingsActionButton
                    type="button"
                    size="icon"
                    tone="danger"
                    className="size-11"
                    aria-label={deleteLabel}
                    onClick={() => onRequestDelete(rule.id)}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
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
