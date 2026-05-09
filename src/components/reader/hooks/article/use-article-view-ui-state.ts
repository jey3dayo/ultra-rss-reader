import { resolvePreferenceValue } from "@/schemas/preferences";
import { usePreferencesStore } from "@/stores/preferences-store";
import { createUiStoreSliceHook } from "../use-ui-store-slice";

const useArticleViewUiStoreSlice = createUiStoreSliceHook((s) => ({
  closeBrowser: s.closeBrowser,
  layoutMode: s.layoutMode,
  contentMode: s.contentMode,
  browserUrl: s.browserUrl,
  selection: s.selection,
  clearArticle: s.clearArticle,
  showToast: s.showToast,
  addRecentlyRead: s.addRecentlyRead,
  retainArticle: s.retainArticle,
  viewMode: s.viewMode,
  setFocusedPane: s.setFocusedPane,
}));

export function useArticleViewUiState() {
  const uiState = useArticleViewUiStoreSlice();
  const afterReading = usePreferencesStore((s) => resolvePreferenceValue(s.prefs, "after_reading"));

  return {
    ...uiState,
    afterReading,
  };
}
