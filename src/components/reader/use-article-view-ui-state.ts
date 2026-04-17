import { resolvePreferenceValue, usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";

export function useArticleViewUiState() {
  const closeBrowser = useUiStore((s) => s.closeBrowser);
  const layoutMode = useUiStore((s) => s.layoutMode);
  const contentMode = useUiStore((s) => s.contentMode);
  const browserUrl = useUiStore((s) => s.browserUrl);
  const clearArticle = useUiStore((s) => s.clearArticle);
  const showToast = useUiStore((s) => s.showToast);
  const addRecentlyRead = useUiStore((s) => s.addRecentlyRead);
  const retainArticle = useUiStore((s) => s.retainArticle);
  const viewMode = useUiStore((s) => s.viewMode);
  const setFocusedPane = useUiStore((s) => s.setFocusedPane);
  const afterReading = usePreferencesStore((s) => resolvePreferenceValue(s.prefs, "after_reading"));

  return {
    closeBrowser,
    layoutMode,
    contentMode,
    browserUrl,
    clearArticle,
    showToast,
    addRecentlyRead,
    retainArticle,
    viewMode,
    setFocusedPane,
    afterReading,
  };
}
