import { ContextMenu } from "@base-ui/react/context-menu";
import { Result } from "@praha/byethrow";
import type { ReactNode } from "react";
import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { ArticleDto } from "@/api/tauri-commands";
import { useArticleActions } from "@/components/reader/hooks/article/use-article-actions";
import { useSetRead, useToggleStar } from "@/hooks/use-articles";
import { copyTextToClipboard } from "@/lib/runtime/clipboard";
import { usePlatformStore } from "@/stores/platform-store";
import { useUiStore } from "@/stores/ui-store";
import { ArticleContextMenuView } from "./article-context-menu-view";
import { CONTEXT_MENU_ACTION_IDS, createMenuActionHandler } from "./context-menu-action-policy";
import { useContextMenuTargetSnapshot } from "./context-menu-target";

type ArticleContextMenuProps = {
  article: ArticleDto;
  feedUrl?: string;
  children: ReactNode;
};

export function ArticleContextMenu({ article, feedUrl, children }: ArticleContextMenuProps) {
  const { t } = useTranslation("reader");
  const contextMenuSource = useMemo(() => ({ article, feedUrl }), [article, feedUrl]);
  const { contextMenuTarget, captureTarget, captureKeyboardTarget, clearTarget } =
    useContextMenuTargetSnapshot(contextMenuSource);
  const targetArticle = contextMenuTarget.article;
  const targetFeedUrl = contextMenuTarget.feedUrl;
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
  });
  const handleCopyFeedUrl = useCallback(async () => {
    if (!targetFeedUrl) {
      return;
    }

    Result.pipe(
      await copyTextToClipboard(targetFeedUrl, { category: "article_link" }),
      Result.inspect(() => showToast(t("copied_to_clipboard"))),
      Result.inspectError((error) => {
        console.error("Copy feed URL failed:", error);
        showToast(error.message);
      }),
    );
  }, [showToast, t, targetFeedUrl]);

  return (
    <ContextMenu.Root onOpenChange={(open) => !open && clearTarget()}>
      <ContextMenu.Trigger
        render={
          // biome-ignore lint/a11y/noStaticElementInteractions: Base UI render prop needs the context menu capture handlers on the inert trigger element wrapping child controls.
          <div
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
        copyFeedUrlLabel={targetFeedUrl ? t("copy_feed_url") : undefined}
        onToggleRead={handleToggleRead}
        onToggleStar={handleToggleStar}
        onOpenInBrowser={targetArticle.url ? handleOpenExternalBrowser : undefined}
        onCopyFeedUrl={
          targetFeedUrl
            ? createMenuActionHandler(CONTEXT_MENU_ACTION_IDS.articleCopyFeedUrl, handleCopyFeedUrl, { showToast })
            : undefined
        }
      />
    </ContextMenu.Root>
  );
}
