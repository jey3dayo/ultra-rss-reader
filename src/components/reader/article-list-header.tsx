import { type RefObject, useCallback, useEffect, useRef } from "react";
import { ArticleListHeaderActions } from "./article-list-header-actions";
import { ArticleListHeaderSearch } from "./article-list-header-search";
import { useReaderPassiveLayoutNotify } from "./reader-passive-layout";

type ArticleListHeaderLabels = {
  markAllReadLabel: string;
  markAllReadButtonText: string;
  searchArticlesLabel: string;
  searchArticlesButtonText: string;
  closeSearchLabel: string;
  searchArticlesPlaceholder: string;
  searchArticlesDescription?: string;
};

export type ArticleListHeaderProps = {
  showSearch: boolean;
  searchQuery: string;
  searchInputRef: RefObject<HTMLInputElement | null>;
  labels: ArticleListHeaderLabels;
  showSidebarButton: boolean;
  sidebarButtonLabel: string;
  sidebarButtonText?: string;
  isSidebarVisible?: boolean;
  onMarkAllRead: () => void;
  markAllReadDisabled?: boolean;
  onToggleSidebar: () => void;
  onToggleSearch: () => void;
  onCloseSearch: () => void;
  onSearchQueryChange: (query: string) => void;
};

export function ArticleListHeader({
  showSearch,
  searchQuery,
  searchInputRef,
  labels,
  showSidebarButton,
  sidebarButtonLabel,
  sidebarButtonText,
  isSidebarVisible,
  onMarkAllRead,
  markAllReadDisabled,
  onToggleSidebar,
  onToggleSearch,
  onCloseSearch,
  onSearchQueryChange,
}: ArticleListHeaderProps) {
  const searchToggleContainerRef = useRef<HTMLSpanElement>(null);
  const titlebarControlReserve = showSidebarButton && isSidebarVisible !== true ? "sidebar-hidden" : undefined;
  const restoreSearchToggleFocus = useCallback(() => {
    searchToggleContainerRef.current?.querySelector("button")?.focus({ preventScroll: true });
  }, []);
  const notifyPassiveLayoutChange = useReaderPassiveLayoutNotify();

  // The search band changes the list body's available height/top; ResizeObserver on the body
  // viewport itself should catch this, but this is the known-change trigger the layout contract
  // requires so a delayed/blocked observer callback cannot leave a stale anchor.
  // biome-ignore lint/correctness/useExhaustiveDependencies: showSearch (not read in the body) is the intended trigger.
  useEffect(() => {
    notifyPassiveLayoutChange();
  }, [showSearch, notifyPassiveLayoutChange]);

  return (
    <>
      <div
        data-article-list-header="true"
        data-titlebar-control-reserve={titlebarControlReserve}
        className="-mr-px flex h-12 items-center border-r border-b border-[var(--subscriptions-pane-divider)] bg-[var(--workspace-header-surface)] px-3 backdrop-blur-sm"
      >
        <ArticleListHeaderActions
          showSearch={showSearch}
          showSidebarButton={showSidebarButton}
          sidebarButtonLabel={sidebarButtonLabel}
          sidebarButtonText={sidebarButtonText}
          isSidebarVisible={isSidebarVisible}
          onMarkAllRead={onMarkAllRead}
          markAllReadDisabled={markAllReadDisabled}
          onToggleSidebar={onToggleSidebar}
          onToggleSearch={onToggleSearch}
          onCloseSearch={onCloseSearch}
          searchToggleContainerRef={searchToggleContainerRef}
          markAllReadLabel={labels.markAllReadLabel}
          markAllReadButtonText={labels.markAllReadButtonText}
          searchArticlesLabel={labels.searchArticlesLabel}
          searchArticlesButtonText={labels.searchArticlesButtonText}
          closeSearchLabel={labels.closeSearchLabel}
        />
      </div>

      {showSearch && (
        <ArticleListHeaderSearch
          searchInputRef={searchInputRef}
          searchQuery={searchQuery}
          searchArticlesLabel={labels.searchArticlesLabel}
          searchArticlesPlaceholder={labels.searchArticlesPlaceholder}
          searchArticlesDescription={labels.searchArticlesDescription ?? ""}
          onSearchQueryChange={onSearchQueryChange}
          onCloseSearch={onCloseSearch}
          onRestoreSearchToggleFocus={restoreSearchToggleFocus}
        />
      )}
    </>
  );
}
