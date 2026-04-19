import { useReducer } from "react";
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

type MuteSettingsState = {
  keyword: string;
  scope: "title" | "body" | "title_and_body";
  confirmRule: MuteKeywordDto | null;
};

type MuteSettingsAction =
  | { type: "set-keyword"; value: string }
  | { type: "reset-keyword" }
  | { type: "set-scope"; value: "title" | "body" | "title_and_body" }
  | { type: "set-confirm-rule"; value: MuteKeywordDto | null };

const initialMuteSettingsState: MuteSettingsState = {
  keyword: "",
  scope: "title_and_body",
  confirmRule: null,
};

function muteSettingsReducer(state: MuteSettingsState, action: MuteSettingsAction): MuteSettingsState {
  switch (action.type) {
    case "set-keyword":
      return { ...state, keyword: action.value };
    case "reset-keyword":
      return { ...state, keyword: "" };
    case "set-scope":
      return { ...state, scope: action.value };
    case "set-confirm-rule":
      return { ...state, confirmRule: action.value };
    default:
      return state;
  }
}

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
  const [state, dispatch] = useReducer(muteSettingsReducer, initialMuteSettingsState);
  const { keyword, scope, confirmRule } = state;
  const autoMarkReadEnabled = resolvePreferenceValue(prefs, "mute_auto_mark_read") === "true";
  const keywordLength = Array.from(keyword.trim()).length;

  const handleAdd = async () => {
    try {
      await createMuteKeyword.mutateAsync({
        keyword,
        scope,
      });
      dispatch({ type: "reset-keyword" });
      showToast(t("mute.add_success"));
    } catch (error) {
      showToast(t("mute.add_failed", { message: getErrorMessage(error) }));
    }
  };

  const handleRequestDelete = (ruleId: string) => {
    const rule = rules.find((candidate) => candidate.id === ruleId) ?? null;
    dispatch({ type: "set-confirm-rule", value: rule });
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
      dispatch({ type: "set-confirm-rule", value: null });
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
    onKeywordChange: (value) => dispatch({ type: "set-keyword", value }),
    onScopeChange: (value) => dispatch({ type: "set-scope", value }),
    onRuleScopeChange: (ruleId, nextScope) => void handleRuleScopeChange(ruleId, nextScope),
    onAutoMarkReadChange: (checked) => void handleAutoMarkReadChange(checked),
    onAdd: () => void handleAdd(),
    onRequestDelete: handleRequestDelete,
    onConfirmDelete: () => void handleConfirmDelete(),
    onCancelDelete: () => dispatch({ type: "set-confirm-rule", value: null }),
  });

  return <MuteSettingsView {...viewProps} />;
}
