import type { TFunction } from "i18next";
import type { MuteKeywordDto } from "@/api/tauri-commands";
import type { MuteSettingsViewProps } from "./mute-settings-view";

type UseMuteSettingsViewPropsParams = {
  t: TFunction<"settings">;
  keyword: string;
  scope: "title" | "body" | "title_and_body";
  rules: MuteKeywordDto[];
  addDisabled: boolean;
  confirmRule: MuteKeywordDto | null;
  onKeywordChange: (value: string) => void;
  onScopeChange: (value: "title" | "body" | "title_and_body") => void;
  onRuleScopeChange: (ruleId: string, value: "title" | "body" | "title_and_body") => void;
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
  confirmRule,
  onKeywordChange,
  onScopeChange,
  onRuleScopeChange,
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
    intro: t("mute.note"),
    keywordLabel: t("mute.keyword"),
    keywordValue: keyword,
    keywordPlaceholder: t("mute.keyword_placeholder"),
    scopeAriaLabel: t("mute.scope"),
    scopeValue: scope,
    scopeOptions,
    addLabel: t("mute.add"),
    onKeywordChange,
    onScopeChange,
    onAdd,
    addDisabled,
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
    comingSoonLabel: t("mute.coming_soon"),
    autoMarkReadHint: t("mute.auto_mark_read_note"),
    confirmOpen: confirmRule !== null,
    confirmMessage: confirmRule
      ? t("mute.confirm_delete_message", {
          keyword: confirmRule.keyword,
          scope: scopeOptions.find((option) => option.value === confirmRule.scope)?.label ?? confirmRule.scope,
        })
      : "",
    confirmActionLabel: t("mute.delete"),
    cancelLabel: t("mute.cancel"),
    onConfirmDelete,
    onCancelDelete,
  };
}
