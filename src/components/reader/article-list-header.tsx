import { useTranslation } from "react-i18next";
import type { ArticleListHeaderProps } from "./article-list.types";
import { ArticleListHeaderActions } from "./article-list-header-actions";
import { ArticleListHeaderSearch } from "./article-list-header-search";

export function ArticleListHeader({
  showSearch,
  searchQuery,
  searchInputRef,
  showSidebarButton,
  sidebarButtonLabel,
  sidebarButtonText,
  isSidebarVisible,
  feedModeControl,
  onMarkAllRead,
  onToggleSidebar,
  onToggleSearch,
  onCloseSearch,
  onSearchQueryChange,
}: ArticleListHeaderProps) {
  const { t } = useTranslation("reader");
  const markAllReadLabel = t("mark_all_as_read");
  const markAllReadButtonText = t("mark_all_read_short");
  const searchArticlesLabel = t("search_articles");
  const searchArticlesButtonText = t("search_short");
  const closeSearchLabel = t("close_search");
  const searchArticlesPlaceholder = t("search_articles_placeholder");
  return (
    <>
      <div className="flex h-12 items-center border-b border-border px-3">
        <ArticleListHeaderActions
          showSearch={showSearch}
          showSidebarButton={showSidebarButton}
          sidebarButtonLabel={sidebarButtonLabel}
          sidebarButtonText={sidebarButtonText}
          isSidebarVisible={isSidebarVisible}
          feedModeControl={feedModeControl}
          onMarkAllRead={onMarkAllRead}
          onToggleSidebar={onToggleSidebar}
          onToggleSearch={onToggleSearch}
          onCloseSearch={onCloseSearch}
          markAllReadLabel={markAllReadLabel}
          markAllReadButtonText={markAllReadButtonText}
          searchArticlesLabel={searchArticlesLabel}
          searchArticlesButtonText={searchArticlesButtonText}
          closeSearchLabel={closeSearchLabel}
        />
      </div>

      {showSearch && (
        <ArticleListHeaderSearch
          searchInputRef={searchInputRef}
          searchQuery={searchQuery}
          searchArticlesLabel={searchArticlesLabel}
          searchArticlesPlaceholder={searchArticlesPlaceholder}
          onSearchQueryChange={onSearchQueryChange}
        />
      )}
    </>
  );
}
