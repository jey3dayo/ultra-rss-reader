import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";

type ConfirmMarkAllReadOptions = {
  count: number;
  onConfirm: () => void;
};

export function useConfirmMarkAllRead() {
  const { t } = useTranslation("reader");
  const { t: tc } = useTranslation("common");
  const askBeforeMarkAll = usePreferencesStore((s) => s.prefs.ask_before_mark_all ?? "true");
  const showConfirm = useUiStore((s) => s.showConfirm);

  return useCallback(
    ({ count, onConfirm }: ConfirmMarkAllReadOptions) => {
      if (count === 0) return;
      if (askBeforeMarkAll === "true") {
        showConfirm(t("confirm_mark_read", { count }), onConfirm, {
          actionLabel: tc("mark_as_read_action"),
          variant: "warning",
        });
        return;
      }
      onConfirm();
    },
    [askBeforeMarkAll, showConfirm, t, tc],
  );
}
