import { resolvePreferenceValue } from "@/schemas/preference-values";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";

export function useArticleListUiState() {
  const selection = useUiStore((s) => s.selection);
  const selectedAccountId = useUiStore((s) => s.selectedAccountId);
  const focusedPane = useUiStore((s) => s.focusedPane);
  const selectedArticleId = useUiStore((s) => s.selectedArticleId);
  const contentMode = useUiStore((s) => s.contentMode);
  const selectArticle = useUiStore((s) => s.selectArticle);
  const clearArticle = useUiStore((s) => s.clearArticle);
  const closeBrowser = useUiStore((s) => s.closeBrowser);
  const openSidebar = useUiStore((s) => s.openSidebar);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const setWebPreviewSessionMode = useUiStore((s) => s.setWebPreviewSessionMode);
  const sidebarOpen = useUiStore((s) => s.sidebarOpen);
  const viewMode = useUiStore((s) => s.viewMode);
  const setViewMode = useUiStore((s) => s.setViewMode);
  const layoutMode = useUiStore((s) => s.layoutMode);
  const recentlyReadIds = useUiStore((s) => s.recentlyReadIds);
  const retainedArticleIds = useUiStore((s) => s.retainedArticleIds);

  const keyboardPrefs = usePreferencesStore((s) => s.prefs);
  const sortUnread = usePreferencesStore((s) => resolvePreferenceValue(s.prefs, "reading_sort"));
  const groupBy = usePreferencesStore((s) => resolvePreferenceValue(s.prefs, "group_by"));
  const dimArchived = usePreferencesStore((s) => resolvePreferenceValue(s.prefs, "dim_archived"));
  const textPreview = usePreferencesStore((s) => resolvePreferenceValue(s.prefs, "text_preview"));
  const imagePreviews = usePreferencesStore((s) => resolvePreferenceValue(s.prefs, "image_previews"));
  const selectionStyle = usePreferencesStore((s) => resolvePreferenceValue(s.prefs, "list_selection_style"));
  const scrollToTopOnChange = usePreferencesStore((s) => resolvePreferenceValue(s.prefs, "scroll_to_top_on_change"));

  return {
    selection,
    selectedAccountId,
    focusedPane,
    selectedArticleId,
    contentMode,
    selectArticle,
    clearArticle,
    closeBrowser,
    openSidebar,
    toggleSidebar,
    setWebPreviewSessionMode,
    sidebarOpen,
    viewMode,
    setViewMode,
    layoutMode,
    recentlyReadIds,
    retainedArticleIds,
    keyboardPrefs,
    sortUnread,
    groupBy,
    dimArchived,
    textPreview,
    imagePreviews,
    selectionStyle,
    scrollToTopOnChange,
  };
}
