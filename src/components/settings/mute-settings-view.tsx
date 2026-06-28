import { AlertTriangle, Trash2 } from "lucide-react";
import type { FormEvent } from "react";
import type { MuteKeywordScope } from "@/api/schemas";
import { SettingsLoadingActionButton } from "@/components/settings/settings-loading-action-button";
import { SettingsActionButton } from "@/components/settings/shared/settings-action-button";
import { SettingsContentLayout } from "@/components/settings/shared/settings-content-layout";
import { SettingsSection } from "@/components/settings/shared/settings-section";
import { SETTINGS_CONTROL_SURFACE_CLASS, SETTINGS_DIVIDER_CLASS } from "@/components/settings/shared/settings-surface";
import { MOTION_CONTENT_SWAP_CLASS_NAME, MOTION_DATA_PHASE_ATTRIBUTE, MOTION_PHASE_ENTERING } from "@/constants/motion";
import { ActionSelectControl, ConfirmDialogView, GradientSwitch, Input, LabeledControlRow } from "@/design-system";
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
      <SettingsContentLayout title={title} titleLayout="stacked-left" outerTestId="mute-settings-root">
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] md:items-start">
          <div className="grid gap-4">
            <SettingsSection heading={addHeading} note={intro} surface="flat" className="px-3 py-2.5 sm:px-4 sm:py-3">
              <form data-testid="mute-settings-add-row" onSubmit={handleAddSubmit} className="space-y-2.5">
                <div className="space-y-1.5">
                  <label
                    className="block text-[12px] font-medium text-[color:var(--form-row-label)]"
                    htmlFor="mute-keyword"
                  >
                    {keywordLabel}
                  </label>
                  <Input
                    id="mute-keyword"
                    name="mute_keyword"
                    value={keywordValue}
                    onChange={(event) => onKeywordChange(event.currentTarget.value)}
                    placeholder={keywordPlaceholder}
                    className={cn("h-9", SETTINGS_CONTROL_SURFACE_CLASS)}
                  />
                </div>
                <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-2">
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
                    triggerClassName={cn("h-9 w-full min-w-0", SETTINGS_CONTROL_SURFACE_CLASS)}
                  />
                  <SettingsLoadingActionButton
                    type="submit"
                    size="compact"
                    className="h-9 min-h-9"
                    disabled={addDisabled}
                    loading={addPending}
                    loadingLabel={addPendingLabel}
                  >
                    {addLabel}
                  </SettingsLoadingActionButton>
                </div>
              </form>
            </SettingsSection>

            <SettingsSection
              heading={autoMarkReadHeading}
              note={autoMarkReadHint}
              surface="flat"
              className="px-3 py-2.5 sm:px-4 sm:py-3"
            >
              <LabeledControlRow label={autoMarkReadLabel}>
                <GradientSwitch
                  checked={autoMarkReadChecked}
                  disabled={autoMarkReadDisabled}
                  aria-label={autoMarkReadLabel}
                  onCheckedChange={onAutoMarkReadChange}
                />
              </LabeledControlRow>
            </SettingsSection>
          </div>

          <SettingsSection
            heading={savedHeading}
            surface="flat"
            className="px-3 py-2.5 sm:px-4 sm:py-3"
            headingClassName="mb-2"
            contentClassName="[&>*:first-child]:pt-0 [&>*:last-child]:pb-0"
          >
            {rules.length === 0 ? (
              <p
                {...{ [MOTION_DATA_PHASE_ATTRIBUTE]: MOTION_PHASE_ENTERING }}
                className={cn(
                  MOTION_CONTENT_SWAP_CLASS_NAME,
                  "border-b py-2 text-sm text-foreground-soft",
                  SETTINGS_DIVIDER_CLASS,
                )}
              >
                {emptyState}
              </p>
            ) : (
              <div>
                {rules.map((rule) => (
                  <div
                    key={rule.id}
                    data-testid={`mute-settings-row-${rule.id}`}
                    className={cn(
                      "motion-contextual-surface flex min-h-12 items-center justify-between gap-3 border-b py-1.5",
                      SETTINGS_DIVIDER_CLASS,
                    )}
                  >
                    <span
                      className="min-w-0 flex-1 truncate text-[13px] leading-[1.35] text-[color:var(--form-row-label)]"
                      dir="auto"
                      title={rule.keyword}
                    >
                      {rule.keyword}
                    </span>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <ActionSelectControl
                        label={rule.keyword}
                        ariaLabel={savedScopeAriaLabel(rule.keyword)}
                        value={rule.scope}
                        options={scopeOptions}
                        onValueChange={(value) =>
                          handleMuteKeywordScopeSelectValue(value, (scope) => onRuleScopeChange(rule.id, scope), {
                            source: "saved-rule",
                            ruleId: rule.id,
                          })
                        }
                        triggerClassName={cn("h-9 w-[9.5rem]", SETTINGS_CONTROL_SURFACE_CLASS)}
                      />
                      <SettingsActionButton
                        type="button"
                        size="icon"
                        tone="danger"
                        className="size-8 min-h-8 min-w-8"
                        aria-label={deleteLabel}
                        onClick={() => onRequestDelete(rule.id)}
                      >
                        <Trash2 className="size-3.5" aria-hidden="true" />
                      </SettingsActionButton>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SettingsSection>
        </div>
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
