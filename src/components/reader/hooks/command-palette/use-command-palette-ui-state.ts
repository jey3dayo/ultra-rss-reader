import { usePlatformStore } from "@/stores/platform-store";
import { usePreferencesStore } from "@/stores/preferences-store";
import {
  createUiOpenCloseToggleStateHook,
  createUiStoreSliceHook,
} from "../use-ui-store-slice";

const useCommandPaletteOpenCloseState = createUiOpenCloseToggleStateHook(
  (state) => ({
    open: state.commandPaletteOpen,
    closeCommandPalette: state.closeCommandPalette,
  }),
);

const useCommandPaletteUiStoreSlice = createUiStoreSliceHook((state) => ({
  openShortcutsHelp: state.openShortcutsHelp,
  showToast: state.showToast,
  selectedAccountId: state.selectedAccountId,
  isSyncing: state.syncProgress.active,
  selectFeedFromCurrentContext: state.selectFeedFromCurrentContext,
  selectTagFromCurrentContext: state.selectTagFromCurrentContext,
  selectArticle: state.selectArticle,
}));

export function useCommandPaletteUiState() {
  const openCloseState = useCommandPaletteOpenCloseState();
  const uiState = useCommandPaletteUiStoreSlice();
  const platformKind = usePlatformStore((state) => state.platform.kind);
  const shortcutPrefs = usePreferencesStore((state) => state.prefs);

  return {
    ...openCloseState,
    ...uiState,
    platformKind,
    shortcutPrefs,
  };
}
