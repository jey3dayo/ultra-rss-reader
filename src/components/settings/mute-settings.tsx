import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { MuteKeywordDto } from "@/api/tauri-commands";
import { MuteSettingsView } from "@/components/settings/mute-settings-view";
import { useMuteSettingsViewProps } from "@/components/settings/use-mute-settings-view-props";
import {
  useCreateMuteKeyword,
  useDeleteMuteKeyword,
  useMuteKeywords,
  useSetMuteAutoMarkRead,
  useUpdateMuteKeyword,
} from "@/hooks/use-mute-keywords";
import { resolvePreferenceValue, usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "object" && error !== null && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return "Unknown error";
}

export function MuteSettings() {
  const { t } = useTranslation("settings");
  const showToast = useUiStore((state) => state.showToast);
  const prefs = usePreferencesStore((state) => state.prefs);
  const { data: rules = [] } = useMuteKeywords();
  const createMuteKeyword = useCreateMuteKeyword();
  const deleteMuteKeyword = useDeleteMuteKeyword();
  const setMuteAutoMarkRead = useSetMuteAutoMarkRead();
  const updateMuteKeyword = useUpdateMuteKeyword();
  const [keyword, setKeyword] = useState("");
  const [scope, setScope] = useState<"title" | "body" | "title_and_body">("title_and_body");
  const [confirmRule, setConfirmRule] = useState<MuteKeywordDto | null>(null);
  const autoMarkReadEnabled = resolvePreferenceValue(prefs, "mute_auto_mark_read") === "true";
  const keywordLength = Array.from(keyword.trim()).length;

  const handleAdd = async () => {
    try {
      await createMuteKeyword.mutateAsync({
        keyword,
        scope,
      });
      setKeyword("");
      showToast(t("mute.add_success"));
    } catch (error) {
      showToast(t("mute.add_failed", { message: getErrorMessage(error) }));
    }
  };

  const handleRequestDelete = (ruleId: string) => {
    const rule = rules.find((candidate) => candidate.id === ruleId) ?? null;
    setConfirmRule(rule);
  };

  const handleConfirmDelete = async () => {
    if (!confirmRule) {
      return;
    }

    try {
      await deleteMuteKeyword.mutateAsync({
        muteKeywordId: confirmRule.id,
      });
      showToast(t("mute.delete_success"));
      setConfirmRule(null);
    } catch (error) {
      showToast(t("mute.delete_failed", { message: getErrorMessage(error) }));
    }
  };

  const handleRuleScopeChange = async (ruleId: string, nextScope: "title" | "body" | "title_and_body") => {
    const currentRule = rules.find((candidate) => candidate.id === ruleId);
    if (!currentRule || currentRule.scope === nextScope) {
      return;
    }

    try {
      await updateMuteKeyword.mutateAsync({
        muteKeywordId: ruleId,
        scope: nextScope,
      });
      showToast(t("mute.update_success"));
    } catch (error) {
      showToast(t("mute.update_failed", { message: getErrorMessage(error) }));
    }
  };

  const handleAutoMarkReadChange = async (checked: boolean) => {
    const previousValue = autoMarkReadEnabled;
    usePreferencesStore.setState((state) => ({
      prefs: { ...state.prefs, mute_auto_mark_read: String(checked) },
    }));

    try {
      await setMuteAutoMarkRead.mutateAsync({ enabled: checked });
    } catch (error) {
      usePreferencesStore.setState((state) => ({
        prefs: { ...state.prefs, mute_auto_mark_read: String(previousValue) },
      }));
      showToast(t("mute.auto_mark_read_failed", { message: getErrorMessage(error) }));
    }
  };

  const viewProps = useMuteSettingsViewProps({
    t,
    keyword,
    scope,
    rules,
    addDisabled: createMuteKeyword.isPending || keywordLength < 3,
    autoMarkReadChecked: autoMarkReadEnabled,
    autoMarkReadDisabled: setMuteAutoMarkRead.isPending,
    confirmRule,
    onKeywordChange: setKeyword,
    onScopeChange: setScope,
    onRuleScopeChange: (ruleId, nextScope) => void handleRuleScopeChange(ruleId, nextScope),
    onAutoMarkReadChange: (checked) => void handleAutoMarkReadChange(checked),
    onAdd: () => void handleAdd(),
    onRequestDelete: handleRequestDelete,
    onConfirmDelete: () => void handleConfirmDelete(),
    onCancelDelete: () => setConfirmRule(null),
  });

  return <MuteSettingsView {...viewProps} />;
}
