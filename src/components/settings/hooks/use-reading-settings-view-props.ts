import type { PlatformKind } from "@/constants/platform";
import type { DevIntent } from "@/dev/intent";
import { useClearArticleViewHistory } from "@/hooks/use-articles";
import { useUiStore } from "@/stores/ui-store";
import { buildReadingSettingsViewProps } from "../lib/reading-settings-view-model";
import type { ReadingSettingsViewProps } from "../reading-settings-view";
import type { SettingsPreferenceViewPropsParams } from "../settings-preference";

type UseReadingSettingsViewPropsParams = SettingsPreferenceViewPropsParams & {
  devIntent: DevIntent;
  platformKind: PlatformKind;
  supportsBackgroundBrowserOpen: boolean;
};

export function useReadingSettingsViewProps(params: UseReadingSettingsViewPropsParams): ReadingSettingsViewProps {
  const selectedAccountId = useUiStore((state) => state.selectedAccountId);
  const showToast = useUiStore((state) => state.showToast);
  const showConfirm = useUiStore((state) => state.showConfirm);
  const clearHistory = useClearArticleViewHistory();

  return buildReadingSettingsViewProps({
    ...params,
    clearHistory,
    selectedAccountId,
    showConfirm,
    showToast,
  });
}
