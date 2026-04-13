import { usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";

export function useArticleListUiState() {
  const selection = useUiStore((s) => s.selection);
  const selectedAccountId = useUiStore((s) => s.selectedAccountId);
  const selectedArticleId = useUiStore((s) => s.selectedArticleId);
  const selectArticle = useUiStore((s) => s.selectArticle);
  const clearArticle = useUiStore((s) => s.clearArticle);
  const openSidebar = useUiStore((s) => s.openSidebar);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const sidebarOpen = useUiStore((s) => s.sidebarOpen);
  const viewMode = useUiStore((s) => s.viewMode);
  const setViewMode = useUiStore((s) => s.setViewMode);
  const layoutMode = useUiStore((s) => s.layoutMode);
  const recentlyReadIds = useUiStore((s) => s.recentlyReadIds);
  const retainedArticleIds = useUiStore((s) => s.retainedArticleIds);

  const keyboardPrefs = usePreferencesStore((s) => s.prefs);
  const sortUnread = usePreferencesStore((s) => s.prefs.reading_sort ?? s.prefs.sort_unread ?? "newest_first");
  const groupBy = usePreferencesStore((s) => s.prefs.group_by ?? "date");
  const dimArchived = usePreferencesStore((s) => s.prefs.dim_archived ?? "true");
  const textPreview = usePreferencesStore((s) => s.prefs.text_preview ?? "true");
  const imagePreviews = usePreferencesStore((s) => s.prefs.image_previews ?? "medium");
  const selectionStyle = usePreferencesStore((s) => s.prefs.list_selection_style ?? "modern");
  const scrollToTopOnChange = usePreferencesStore((s) => s.prefs.scroll_to_top_on_change ?? "true");

  return {
    selection,
    selectedAccountId,
    selectedArticleId,
    selectArticle,
    clearArticle,
    openSidebar,
    toggleSidebar,
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
