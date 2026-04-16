import { ContextMenu } from "@base-ui/react/context-menu";
import { useTranslation } from "react-i18next";
import { useSetRead, useToggleStar } from "@/hooks/use-articles";
import { usePlatformStore } from "@/stores/platform-store";
import { useUiStore } from "@/stores/ui-store";
import { ArticleContextMenuView } from "./article-context-menu-view";
import type { ArticleContextMenuProps } from "./article-menu.types";
import { useArticleActions } from "./use-article-actions";

export function ArticleContextMenu({ article, children }: ArticleContextMenuProps) {
  const { t } = useTranslation("reader");
  const setRead = useSetRead();
  const toggleStar = useToggleStar();
  const addRecentlyRead = useUiStore((s) => s.addRecentlyRead);
  const removeRecentlyRead = useUiStore((s) => s.removeRecentlyRead);
  const retainArticle = useUiStore((s) => s.retainArticle);
  const viewMode = useUiStore((s) => s.viewMode);
  const selection = useUiStore((s) => s.selection);
  const showToast = useUiStore((s) => s.showToast);
  const supportsReadingList = usePlatformStore((s) => s.platform.capabilities.supports_reading_list);
  const retainOnUnstar = viewMode === "starred" || (selection.type === "smart" && selection.kind === "starred");
  const { handleToggleRead, handleToggleStar, handleOpenExternalBrowser } = useArticleActions({
    article,
    viewMode,
    retainOnUnstar,
    supportsReadingList,
    showToast,
    addRecentlyRead,
    removeRecentlyRead,
    retainArticle,
    setRead,
    toggleStar,
  });

  return (
    <ContextMenu.Root>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: Base UI render prop requires event handler on static element to prevent parent context menu trigger */}
      <ContextMenu.Trigger render={<div onContextMenu={(e) => e.stopPropagation()} />}>{children}</ContextMenu.Trigger>
      <ArticleContextMenuView
        toggleReadLabel={article.is_read ? t("mark_as_unread") : t("mark_as_read")}
        toggleStarLabel={article.is_starred ? t("unstar") : t("star")}
        openInBrowserLabel={article.url ? t("open_in_browser") : undefined}
        onToggleRead={handleToggleRead}
        onToggleStar={handleToggleStar}
        onOpenInBrowser={article.url ? handleOpenExternalBrowser : undefined}
      />
    </ContextMenu.Root>
  );
}
