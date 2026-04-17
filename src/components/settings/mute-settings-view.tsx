import { AlertTriangle } from "lucide-react";
import { SettingsContentLayout } from "@/components/settings/settings-content-layout";
import { SettingsSection } from "@/components/settings/settings-section";
import { ConfirmDialogView } from "@/components/shared/confirm-dialog-view";
import { GradientSwitch } from "@/components/shared/gradient-switch";
import { LabeledControlRow } from "@/components/shared/labeled-control-row";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "@/components/ui/select";

export type MuteSettingsScopeOption = {
  value: "title" | "body" | "title_and_body";
  label: string;
};

export type MuteSettingsSavedRule = {
  id: string;
  keyword: string;
  scope: "title" | "body" | "title_and_body";
};

export type MuteSettingsViewProps = {
  title: string;
  addHeading: string;
  intro: string;
  keywordLabel: string;
  keywordValue: string;
  keywordPlaceholder: string;
  scopeAriaLabel: string;
  scopeValue: "title" | "body" | "title_and_body";
  scopeOptions: MuteSettingsScopeOption[];
  addLabel: string;
  onKeywordChange: (value: string) => void;
  onScopeChange: (value: "title" | "body" | "title_and_body") => void;
  onAdd: () => void;
  addDisabled: boolean;
  savedHeading: string;
  emptyState: string;
  rules: MuteSettingsSavedRule[];
  savedScopeAriaLabel: (keyword: string) => string;
  onRuleScopeChange: (ruleId: string, scope: "title" | "body" | "title_and_body") => void;
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
  cancelLabel: string;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
};

function getScopeLabel(options: readonly MuteSettingsScopeOption[], value: string) {
  return options.find((option) => option.value === value)?.label ?? value;
}

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
  cancelLabel,
  onConfirmDelete,
  onCancelDelete,
}: MuteSettingsViewProps) {
  return (
    <>
      <SettingsContentLayout title={title} outerTestId="mute-settings-root">
        <SettingsSection heading={addHeading} note={intro} surface="flat" className="mb-6 sm:mb-7">
          <LabeledControlRow
            label={keywordLabel}
            className="items-start sm:items-center"
            labelClassName="sm:w-40 sm:shrink-0"
          >
            <div
              data-testid="mute-settings-add-row"
              className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-[30rem] sm:max-w-[30rem] sm:flex-row sm:items-center sm:justify-end"
            >
              <Input
                name="mute_keyword"
                aria-label={keywordLabel}
                value={keywordValue}
                onChange={(event) => onKeywordChange(event.target.value)}
                placeholder={keywordPlaceholder}
                className="h-10 w-full sm:w-[220px] sm:flex-none"
              />
              <Select value={scopeValue} onValueChange={(value) => value && onScopeChange(value as typeof scopeValue)}>
                <SelectTrigger aria-label={scopeAriaLabel} className="h-10 w-full sm:w-[192px]">
                  <SelectValue>
                    {(selectedValue: string | null) => getScopeLabel(scopeOptions, selectedValue ?? scopeValue)}
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
              <Button type="button" className="h-10 sm:px-4 sm:flex-none" onClick={onAdd} disabled={addDisabled}>
                {addLabel}
              </Button>
            </div>
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
            <p className="border-b border-border py-3 text-sm text-foreground-soft">{emptyState}</p>
          ) : (
            rules.map((rule) => (
              <LabeledControlRow
                key={rule.id}
                label={rule.keyword}
                labelClassName="sm:max-w-[280px] sm:shrink-0 sm:truncate"
              >
                <div className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-[18rem] sm:flex-row sm:items-center sm:justify-end">
                  <Select
                    value={rule.scope}
                    onValueChange={(value) => value && onRuleScopeChange(rule.id, value as typeof rule.scope)}
                  >
                    <SelectTrigger
                      aria-label={savedScopeAriaLabel(rule.keyword)}
                      className="h-7 w-full text-[0.8rem] sm:w-[192px]"
                    >
                      <SelectValue>
                        {(selectedValue: string | null) => getScopeLabel(scopeOptions, selectedValue ?? rule.scope)}
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
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="sm:flex-none"
                    onClick={() => onRequestDelete(rule.id)}
                  >
                    {deleteLabel}
                  </Button>
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
        onOpenChange={(open) => !open && onCancelDelete()}
        onConfirm={onConfirmDelete}
        onCancel={onCancelDelete}
      />
    </>
  );
}
