import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ArticleDto, FeedDto } from "@/api/tauri-commands";
import { useArticleActions } from "@/components/reader/hooks/article/use-article-actions";
import { ContextMenu } from "@/design-system/context-menu";
import { useSetRead, useToggleStar } from "@/hooks/use-articles";
import { cn } from "@/lib/utils";
import { usePlatformStore } from "@/stores/platform-store";
import { useUiStore } from "@/stores/ui-store";
import { ArticleContextMenuView } from "./article-context-menu-view";
import { CONTEXT_MENU_ACTION_IDS, createMenuActionHandler } from "./context-menu-action-policy";
import { useContextMenuTargetSnapshot } from "./context-menu-target";
import { FeedEditDialog } from "./feed-edit-dialog";

type ArticleContextMenuProps = {
  article: ArticleDto;
  sourceFeed?: FeedDto;
  children: ReactNode;
  triggerClassName?: string;
};

export function ArticleContextMenu({ article, sourceFeed, children, triggerClassName }: ArticleContextMenuProps) {
  const { t } = useTranslation("reader");
  const contextMenuSource = useMemo(() => ({ article, sourceFeed }), [article, sourceFeed]);
  const { contextMenuTarget, captureTarget, captureKeyboardTarget, clearTarget } =
    useContextMenuTargetSnapshot(contextMenuSource);
  const targetArticle = contextMenuTarget.article;
  const targetSourceFeed = contextMenuTarget.sourceFeed;
  const [feedEditTarget, setFeedEditTarget] = useState<FeedDto | null>(null);
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
  const { handleToggleRead, handleToggleStar, handleOpenExternalBrowser, handleCopyLink } = useArticleActions({
    article: targetArticle,
    viewMode,
    retainOnUnstar,
    supportsReadingList,
    showToast,
    addRecentlyRead,
    removeRecentlyRead,
    retainArticle,
    setRead,
    toggleStar,
    enableKeyboardShortcuts: false,
  });

  return (
    <ContextMenu.Root onOpenChange={(open) => !open && clearTarget()}>
      <ContextMenu.Trigger
        render={
          // biome-ignore lint/a11y/noStaticElementInteractions: Base UI render prop needs the context menu capture handlers on the inert trigger element wrapping child controls.
          <div
            className={cn(triggerClassName)}
            onContextMenu={(event) => {
              captureTarget();
              event.stopPropagation();
            }}
            onKeyDownCapture={captureKeyboardTarget}
          />
        }
      >
        {children}
      </ContextMenu.Trigger>
      <ArticleContextMenuView
        toggleReadLabel={targetArticle.is_read ? t("mark_as_unread") : t("mark_as_read")}
        toggleStarLabel={targetArticle.is_starred ? t("unstar") : t("star")}
        openInBrowserLabel={targetArticle.url ? t("open_article_in_browser") : undefined}
        copyArticleLinkLabel={targetArticle.url ? t("copy_article_link") : undefined}
        onToggleRead={handleToggleRead}
        onToggleStar={handleToggleStar}
        onOpenInBrowser={targetArticle.url ? handleOpenExternalBrowser : undefined}
        onCopyArticleLink={
          targetArticle.url
            ? createMenuActionHandler(CONTEXT_MENU_ACTION_IDS.articleCopyLink, handleCopyLink, { showToast })
            : undefined
        }
        editSourceFeedLabel={targetSourceFeed ? t("edit_source_feed_ellipsis") : undefined}
        onEditSourceFeed={
          targetSourceFeed
            ? createMenuActionHandler(CONTEXT_MENU_ACTION_IDS.articleSourceFeedEdit, () => {
                setFeedEditTarget(targetSourceFeed);
              })
            : undefined
        }
      />
      {feedEditTarget ? (
        <FeedEditDialog
          feed={feedEditTarget}
          open={true}
          onOpenChange={(open) => {
            if (!open) {
              setFeedEditTarget(null);
            }
          }}
        />
      ) : null}
    </ContextMenu.Root>
  );
}
