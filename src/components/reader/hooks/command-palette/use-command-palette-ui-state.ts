import { usePlatformStore } from "@/stores/platform-store";
import { usePreferencesStore } from "@/stores/preferences-store";
import { createUiOpenCloseToggleStateHook, createUiStoreSliceHook } from "../use-ui-store-slice";

const useCommandPaletteOpenCloseState = createUiOpenCloseToggleStateHook((state) => ({
  open: state.commandPaletteOpen,
  closeCommandPalette: state.closeCommandPalette,
}));

const useCommandPaletteUiStoreSlice = createUiStoreSliceHook((state) => ({
  openShortcutsHelp: state.openShortcutsHelp,
  showToast: state.showToast,
  selectedAccountId: state.selectedAccountId,
  selectFeedFromCurrentContext: state.selectFeedFromCurrentContext,
  selectFolderFromCurrentContext: state.selectFolderFromCurrentContext,
  selectTagFromCurrentContext: state.selectTagFromCurrentContext,
  selectArticle: state.selectArticle,
}));

export function useCommandPaletteUiState() {
  const openCloseState = useCommandPaletteOpenCloseState();
  const uiState = useCommandPaletteUiStoreSlice();
  const platformKind = usePlatformStore((state) => state.platform.kind);
  const manualUpdateCheckAvailable = usePlatformStore((state) => state.platform.manual_update_check_available === true);
  const manualUpdateCheckAvailabilityKnown = usePlatformStore(
    (state) => state.loaded && !state.loadError && state.platform.manual_update_check_available !== undefined,
  );
  const shortcutPrefs = usePreferencesStore((state) => state.prefs);

  return {
    ...openCloseState,
    ...uiState,
    platformKind,
    manualUpdateCheckAvailable,
    manualUpdateCheckAvailabilityKnown,
    shortcutPrefs,
  };
}
