import { usePlatformStore } from "@/stores/platform-store";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";

export function useCommandPaletteUiState() {
  const open = useUiStore((state) => state.commandPaletteOpen);
  const closeCommandPalette = useUiStore((state) => state.closeCommandPalette);
  const openShortcutsHelp = useUiStore((state) => state.openShortcutsHelp);
  const showToast = useUiStore((state) => state.showToast);
  const selectedAccountId = useUiStore((state) => state.selectedAccountId);
  const selectFeed = useUiStore((state) => state.selectFeed);
  const selectTag = useUiStore((state) => state.selectTag);
  const selectArticle = useUiStore((state) => state.selectArticle);

  const platformKind = usePlatformStore((state) => state.platform.kind);
  const shortcutPrefs = usePreferencesStore((state) => state.prefs);

  return {
    open,
    closeCommandPalette,
    openShortcutsHelp,
    showToast,
    selectedAccountId,
    selectFeed,
    selectTag,
    selectArticle,
    platformKind,
    shortcutPrefs,
  };
}
