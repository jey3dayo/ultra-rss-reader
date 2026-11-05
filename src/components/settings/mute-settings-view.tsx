import { cn } from "cn";
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
  Input,
  LabeledControlRow,
  SettingsInfoPopover,
  SurfaceCard,
} from "@/design-system";
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
  keywordHint: string;
  keywordHelp: string;
  keywordInfoAriaLabel: string;
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
  addErrorMessage?: string | null;
  savedHeading: string;
  emptyState: string;
  rules: MuteSettingsKeywordRow[];
  ruleScopeErrorMessage?: string | null;
  savedScopeAriaLabel: (keyword: string) => string;
  onRuleScopeChange: (ruleId: string, scope: MuteKeywordScope) => void;
  deleteLabel: string;
  onRequestDelete: (ruleId: string) => void;
  autoMarkReadHeading: string;
  autoMarkReadLabel: string;
  autoMarkReadChecked: boolean;
  autoMarkReadDisabled: boolean;
  autoMarkReadHint: string;
  autoMarkReadSummary: string;
  autoMarkReadInfoAriaLabel: string;
  autoMarkReadErrorMessage?: string | null;
  onAutoMarkReadChange: (checked: boolean) => void;
  confirmOpen: boolean;
  confirmMessage: string;
  confirmActionLabel: string;
  confirmPending?: boolean;
  confirmErrorMessage?: string | null;
  cancelLabel: string;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
};

function MuteSettingsErrorAlert({ message, className }: { message?: string | null; className?: string }) {
  if (!message) {
    return null;
  }

  return (
    <SurfaceCard variant="info" tone="danger" padding="compact" role="alert" className={className}>
      <p className="text-sm leading-[1.5]">{message}</p>
    </SurfaceCard>
  );
}

export function MuteSettingsView({
  title,
  addHeading,
  intro,
  keywordLabel,
  keywordHint,
  keywordHelp,
  keywordInfoAriaLabel,
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
  addErrorMessage,
  savedHeading,
  emptyState,
  rules,
  ruleScopeErrorMessage,
  savedScopeAriaLabel,
  onRuleScopeChange,
  deleteLabel,
  onRequestDelete,
  autoMarkReadHeading,
  autoMarkReadLabel,
  autoMarkReadChecked,
  autoMarkReadDisabled,
  autoMarkReadHint,
  autoMarkReadSummary,
  autoMarkReadInfoAriaLabel,
  autoMarkReadErrorMessage,
  onAutoMarkReadChange,
  confirmOpen,
  confirmMessage,
  confirmActionLabel,
  confirmPending = false,
  confirmErrorMessage,
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
                <LabeledControlRow
                  label={keywordLabel}
                  htmlFor="mute-keyword"
                  description={keywordHint}
                  labelAccessory={
                    <SettingsInfoPopover title={keywordLabel} content={keywordHelp} ariaLabel={keywordInfoAriaLabel} />
                  }
                  className="min-h-0 border-b-0 py-0 lg:grid-cols-1 lg:gap-y-1.5"
                  labelClassName="text-(length:--font-size-xs)"
                >
                  {({ descriptionId }) => (
                    <Input
                      id="mute-keyword"
                      name="mute_keyword"
                      value={keywordValue}
                      onChange={(event) => onKeywordChange(event.currentTarget.value)}
                      placeholder={keywordPlaceholder}
                      aria-describedby={descriptionId}
                      className={cn("h-9", SETTINGS_CONTROL_SURFACE_CLASS)}
                    />
                  )}
                </LabeledControlRow>
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
                <MuteSettingsErrorAlert message={addErrorMessage} />
              </form>
            </SettingsSection>

            <SettingsSection heading={autoMarkReadHeading} surface="flat" className="px-3 py-2.5 sm:px-4 sm:py-3">
              <LabeledControlRow
                label={autoMarkReadLabel}
                description={autoMarkReadSummary}
                labelAccessory={
                  <SettingsInfoPopover
                    title={autoMarkReadLabel}
                    content={autoMarkReadHint}
                    ariaLabel={autoMarkReadInfoAriaLabel}
                  />
                }
              >
                <GradientSwitch
                  checked={autoMarkReadChecked}
                  disabled={autoMarkReadDisabled}
                  aria-label={autoMarkReadLabel}
                  onCheckedChange={onAutoMarkReadChange}
                />
              </LabeledControlRow>
              <MuteSettingsErrorAlert message={autoMarkReadErrorMessage} className="mt-2.5" />
            </SettingsSection>
          </div>

          <SettingsSection
            heading={savedHeading}
            surface="flat"
            className="px-3 py-2.5 sm:px-4 sm:py-3"
            headingClassName="mb-2"
            contentClassName="[&>*:first-child]:pt-0 [&>*:last-child:not([role=alert])]:pb-0"
          >
            <MuteSettingsErrorAlert message={ruleScopeErrorMessage} className="mb-2" />
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
                      "motion-contextual-surface flex min-h-12 items-center justify-between gap-3 border-b py-1.5 last:border-b-0",
                      SETTINGS_DIVIDER_CLASS,
                    )}
                  >
                    <span
                      className="min-w-0 flex-1 truncate text-(length:--font-size-sm) leading-[1.35] text-[color:var(--form-row-label)]"
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
        errorMessage={confirmErrorMessage}
        onOpenChange={(open) => !open && onCancelDelete()}
        onConfirm={onConfirmDelete}
        onCancel={onCancelDelete}
      />
    </>
  );
}
