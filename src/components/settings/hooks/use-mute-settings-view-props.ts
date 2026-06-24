import type { TFunction } from "i18next";
import type { MuteKeywordScope } from "@/api/schemas";
import type { MuteKeywordDto } from "@/api/tauri-commands";
import { getOptionLabelByValue } from "@/lib/ui/options";
import type { MuteSettingsViewProps } from "../mute-settings-view";

type UseMuteSettingsViewPropsParams = {
  t: TFunction<"settings">;
  keyword: string;
  scope: MuteKeywordScope;
  rules: MuteKeywordDto[];
  addDisabled: boolean;
  addPending?: boolean;
  autoMarkReadChecked: boolean;
  autoMarkReadDisabled: boolean;
  confirmRule: MuteKeywordDto | null;
  confirmPending?: boolean;
  onKeywordChange: (value: string) => void;
  onScopeChange: (value: MuteKeywordScope) => void;
  onRuleScopeChange: (ruleId: string, value: MuteKeywordScope) => void;
  onAutoMarkReadChange: (checked: boolean) => void;
  onAdd: () => void;
  onRequestDelete: (ruleId: string) => void;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
};

export function useMuteSettingsViewProps({
  t,
  keyword,
  scope,
  rules,
  addDisabled,
  addPending,
  autoMarkReadChecked,
  autoMarkReadDisabled,
  confirmRule,
  confirmPending,
  onKeywordChange,
  onScopeChange,
  onRuleScopeChange,
  onAutoMarkReadChange,
  onAdd,
  onRequestDelete,
  onConfirmDelete,
  onCancelDelete,
}: UseMuteSettingsViewPropsParams): MuteSettingsViewProps {
  const scopeOptions: MuteSettingsViewProps["scopeOptions"] = [
    { value: "title", label: t("mute.scope_title") },
    { value: "body", label: t("mute.scope_body") },
    { value: "title_and_body", label: t("mute.scope_title_and_body") },
  ];

  const savedRules = rules.map((rule) => ({
    id: rule.id,
    keyword: rule.keyword,
    scope: rule.scope,
  }));

  return {
    title: t("mute.heading"),
    addHeading: t("mute.add_heading"),
    intro: `${t("mute.note")} ${t("mute.keyword_too_short_note")}`,
    keywordLabel: t("mute.keyword"),
    keywordValue: keyword,
    keywordPlaceholder: t("mute.keyword_placeholder"),
    scopeAriaLabel: t("mute.scope"),
    scopeValue: scope,
    scopeOptions,
    addLabel: t("mute.add"),
    addPendingLabel: t("mute.adding"),
    onKeywordChange,
    onScopeChange,
    onAdd,
    addDisabled,
    addPending,
    savedHeading: t("mute.saved"),
    emptyState: t("mute.empty_state"),
    rules: savedRules,
    savedScopeAriaLabel: (savedKeyword: string) =>
      t("mute.saved_scope_aria_label", {
        keyword: savedKeyword,
        defaultValue: "Scope for {{keyword}}",
      }),
    onRuleScopeChange: (ruleId, value) => onRuleScopeChange(ruleId, value),
    deleteLabel: t("mute.delete"),
    onRequestDelete,
    autoMarkReadHeading: t("mute.behavior"),
    autoMarkReadLabel: t("mute.auto_mark_read"),
    autoMarkReadChecked,
    autoMarkReadDisabled,
    autoMarkReadHint: t("mute.auto_mark_read_note"),
    onAutoMarkReadChange,
    confirmOpen: confirmRule !== null,
    confirmMessage: confirmRule
      ? t("mute.confirm_delete_message", {
          keyword: confirmRule.keyword,
          scope: getOptionLabelByValue(scopeOptions, confirmRule.scope),
        })
      : "",
    confirmActionLabel: t("mute.delete"),
    confirmPending,
    cancelLabel: t("mute.cancel"),
    onConfirmDelete,
    onCancelDelete,
  };
}
