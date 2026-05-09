import { usePlatformStore } from "@/stores/platform-store";
import { usePreferencesStore } from "@/stores/preferences-store";
import { createUiStoreSliceHook } from "../use-ui-store-slice";

const useCommandPaletteUiStoreSlice = createUiStoreSliceHook((state) => ({
  open: state.commandPaletteOpen,
  closeCommandPalette: state.closeCommandPalette,
  openShortcutsHelp: state.openShortcutsHelp,
  showToast: state.showToast,
  selectedAccountId: state.selectedAccountId,
  isSyncing: state.syncProgress.active,
  selectFeedFromCurrentContext: state.selectFeedFromCurrentContext,
  selectTagFromCurrentContext: state.selectTagFromCurrentContext,
  selectArticle: state.selectArticle,
}));

export function useCommandPaletteUiState() {
  const uiState = useCommandPaletteUiStoreSlice();
  const platformKind = usePlatformStore((state) => state.platform.kind);
  const shortcutPrefs = usePreferencesStore((state) => state.prefs);

  return {
    ...uiState,
    platformKind,
    shortcutPrefs,
  };
}
