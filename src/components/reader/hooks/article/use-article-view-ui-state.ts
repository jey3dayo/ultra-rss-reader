import { resolvePreferenceValue } from "@/schemas/preferences";
import { usePreferencesStore } from "@/stores/preferences-store";
import { createUiOpenCloseToggleStateHook, createUiStoreSliceHook } from "../use-ui-store-slice";

const useArticleViewOpenCloseState = createUiOpenCloseToggleStateHook((s) => ({
  closeBrowser: s.closeBrowser,
  contentMode: s.contentMode,
  browserUrl: s.browserUrl,
}));

const useArticleViewUiStoreSlice = createUiStoreSliceHook((s) => ({
  layoutMode: s.layoutMode,
  selection: s.selection,
  clearArticle: s.clearArticle,
  showToast: s.showToast,
  addRecentlyRead: s.addRecentlyRead,
  retainArticle: s.retainArticle,
  viewMode: s.viewMode,
  setFocusedPane: s.setFocusedPane,
}));

export function useArticleViewUiState() {
  const openCloseState = useArticleViewOpenCloseState();
  const uiState = useArticleViewUiStoreSlice();
  const afterReading = usePreferencesStore((s) => resolvePreferenceValue(s.prefs, "after_reading"));

  return {
    ...openCloseState,
    ...uiState,
    afterReading,
  };
}
