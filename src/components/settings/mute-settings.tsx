import { useReducer, useRef } from "react";
import { useTranslation } from "react-i18next";
import type { MuteKeywordScope } from "@/api/schemas";
import type { MuteKeywordDto } from "@/api/tauri-commands";
import { useMuteSettingsViewProps } from "@/components/settings/hooks/use-mute-settings-view-props";
import { MuteSettingsView } from "@/components/settings/mute-settings-view";
import {
  useCreateMuteKeyword,
  useDeleteMuteKeyword,
  useMuteKeywords,
  useSetMuteAutoMarkRead,
  useUpdateMuteKeyword,
} from "@/hooks/use-mute-keywords";
import { getErrorMessage } from "@/lib/ui/errors";
import { resolvePreferenceValue } from "@/schemas/preferences";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";

type MuteSettingsState = {
  keyword: string;
  scope: MuteKeywordScope;
  confirmRule: MuteKeywordDto | null;
};

type MuteSettingsAction =
  | { type: "set-keyword"; value: string }
  | { type: "reset-keyword" }
  | { type: "set-scope"; value: MuteKeywordScope }
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

export function MuteSettings() {
  const { t } = useTranslation("settings");
  const showToast = useUiStore((state) => state.showToast);
  const prefs = usePreferencesStore((state) => state.prefs);
  const { data: rules = [] } = useMuteKeywords();
  const createMuteKeyword = useCreateMuteKeyword();
  const deleteMuteKeyword = useDeleteMuteKeyword();
  const setMuteAutoMarkRead = useSetMuteAutoMarkRead();
  const updateMuteKeyword = useUpdateMuteKeyword();
  const ruleScopeUpdateRevisionRef = useRef<Record<string, number>>({});
  const [state, dispatch] = useReducer(muteSettingsReducer, initialMuteSettingsState);
  const { keyword, scope, confirmRule } = state;
  const autoMarkReadEnabled = resolvePreferenceValue(prefs, "mute_auto_mark_read") === "true";
  const keywordLength = Array.from(keyword.trim()).length;

  const handleAdd = async () => {
    const trimmedKeyword = keyword.trim();
    try {
      await createMuteKeyword.mutateAsync({
        keyword: trimmedKeyword,
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

  const handleRuleScopeChange = async (ruleId: string, nextScope: MuteKeywordScope) => {
    const currentRule = rules.find((candidate) => candidate.id === ruleId);
    if (!currentRule || currentRule.scope === nextScope) {
      return;
    }

    const revision = (ruleScopeUpdateRevisionRef.current[ruleId] ?? 0) + 1;
    ruleScopeUpdateRevisionRef.current = {
      ...ruleScopeUpdateRevisionRef.current,
      [ruleId]: revision,
    };

    try {
      await updateMuteKeyword.mutateAsync({
        muteKeywordId: ruleId,
        scope: nextScope,
      });
      if (ruleScopeUpdateRevisionRef.current[ruleId] !== revision) {
        return;
      }
      showToast(t("mute.update_success"));
    } catch (error) {
      if (ruleScopeUpdateRevisionRef.current[ruleId] !== revision) {
        return;
      }
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
