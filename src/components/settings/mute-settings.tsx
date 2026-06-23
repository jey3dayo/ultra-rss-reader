import { useReducer, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { MuteKeywordScope } from "@/api/schemas";
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
  confirmRuleId: string | null;
};

type MuteSettingsAction =
  | { type: "set-keyword"; value: string }
  | { type: "reset-keyword" }
  | { type: "set-scope"; value: MuteKeywordScope }
  | { type: "set-confirm-rule-id"; value: string | null };

const initialMuteSettingsState: MuteSettingsState = {
  keyword: "",
  scope: "title_and_body",
  confirmRuleId: null,
};

function muteSettingsReducer(state: MuteSettingsState, action: MuteSettingsAction): MuteSettingsState {
  switch (action.type) {
    case "set-keyword":
      return { ...state, keyword: action.value };
    case "reset-keyword":
      return { ...state, keyword: "" };
    case "set-scope":
      return { ...state, scope: action.value };
    case "set-confirm-rule-id":
      return { ...state, confirmRuleId: action.value };
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
  const autoMarkReadRevisionRef = useRef(0);
  const createInFlightRef = useRef(false);
  const confirmDeleteInFlightRef = useRef(false);
  const [confirmDeleteInFlight, setConfirmDeleteInFlight] = useState(false);
  const [state, dispatch] = useReducer(muteSettingsReducer, initialMuteSettingsState);
  const { keyword, scope, confirmRuleId } = state;
  const confirmRule = confirmRuleId ? (rules.find((candidate) => candidate.id === confirmRuleId) ?? null) : null;
  const autoMarkReadEnabled = resolvePreferenceValue(prefs, "mute_auto_mark_read") === "true";
  const keywordLength = Array.from(keyword.trim()).length;

  const handleAdd = async () => {
    const trimmedKeyword = keyword.trim();
    if (trimmedKeyword.length < 3 || createInFlightRef.current) {
      return;
    }

    createInFlightRef.current = true;
    try {
      await createMuteKeyword.mutateAsync({
        keyword: trimmedKeyword,
        scope,
      });
      dispatch({ type: "reset-keyword" });
      showToast(t("mute.add_success"));
    } catch (error) {
      showToast(t("mute.add_failed", { message: getErrorMessage(error) }));
    } finally {
      createInFlightRef.current = false;
    }
  };

  const handleRequestDelete = (ruleId: string) => {
    const rule = rules.find((candidate) => candidate.id === ruleId) ?? null;
    confirmDeleteInFlightRef.current = false;
    setConfirmDeleteInFlight(false);
    dispatch({ type: "set-confirm-rule-id", value: rule?.id ?? null });
  };

  const handleConfirmDelete = async () => {
    if (!confirmRuleId || confirmDeleteInFlightRef.current) {
      return;
    }

    const currentRule = rules.find((candidate) => candidate.id === confirmRuleId);
    if (!currentRule) {
      dispatch({ type: "set-confirm-rule-id", value: null });
      return;
    }

    confirmDeleteInFlightRef.current = true;
    setConfirmDeleteInFlight(true);
    try {
      await deleteMuteKeyword.mutateAsync({
        muteKeywordId: currentRule.id,
      });
      showToast(t("mute.delete_success"));
      dispatch({ type: "set-confirm-rule-id", value: null });
      confirmDeleteInFlightRef.current = false;
      setConfirmDeleteInFlight(false);
    } catch (error) {
      showToast(t("mute.delete_failed", { message: getErrorMessage(error) }));
      confirmDeleteInFlightRef.current = false;
      setConfirmDeleteInFlight(false);
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
    const revision = autoMarkReadRevisionRef.current + 1;
    autoMarkReadRevisionRef.current = revision;
    const previousValue = autoMarkReadEnabled;
    usePreferencesStore.setState((state) => ({
      prefs: { ...state.prefs, mute_auto_mark_read: String(checked) },
    }));

    try {
      await setMuteAutoMarkRead.mutateAsync({ enabled: checked });
    } catch (error) {
      if (autoMarkReadRevisionRef.current !== revision) {
        return;
      }
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
    addPending: createMuteKeyword.isPending,
    autoMarkReadChecked: autoMarkReadEnabled,
    autoMarkReadDisabled: setMuteAutoMarkRead.isPending,
    confirmRule,
    confirmPending: confirmDeleteInFlight || deleteMuteKeyword.isPending,
    onKeywordChange: (value) => dispatch({ type: "set-keyword", value }),
    onScopeChange: (value) => dispatch({ type: "set-scope", value }),
    onRuleScopeChange: (ruleId, nextScope) => void handleRuleScopeChange(ruleId, nextScope),
    onAutoMarkReadChange: (checked) => void handleAutoMarkReadChange(checked),
    onAdd: () => void handleAdd(),
    onRequestDelete: handleRequestDelete,
    onConfirmDelete: () => void handleConfirmDelete(),
    onCancelDelete: () => {
      if (confirmDeleteInFlightRef.current) {
        return;
      }
      dispatch({ type: "set-confirm-rule-id", value: null });
    },
  });

  return <MuteSettingsView {...viewProps} />;
}
