import { cn } from "cn";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ArticleDto, FeedDto } from "@/api/tauri-commands";
import { useArticleCommands } from "@/components/reader/hooks/article/use-article-commands";
import { ContextMenu } from "@/design-system/context-menu";
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
  const showToast = useUiStore((s) => s.showToast);
  const commands = useArticleCommands(targetArticle);

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
        onToggleRead={commands.toggleRead}
        onToggleStar={commands.toggleStar}
        onOpenInBrowser={targetArticle.url ? commands.openInExternalBrowser : undefined}
        onCopyArticleLink={
          targetArticle.url
            ? createMenuActionHandler(CONTEXT_MENU_ACTION_IDS.articleCopyLink, commands.copyLink, { showToast })
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
