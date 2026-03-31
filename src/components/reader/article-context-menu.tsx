import { ContextMenu } from "@base-ui/react/context-menu";
import { Result } from "@praha/byethrow";
import type { ArticleDto } from "@/api/tauri-commands";
import { openInBrowser } from "@/api/tauri-commands";
import { useSetRead, useToggleStar } from "@/hooks/use-articles";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";
import { ArticleContextMenuView } from "./article-context-menu-view";

export function ArticleContextMenu({ article, children }: { article: ArticleDto; children: React.ReactNode }) {
  const setRead = useSetRead();
  const toggleStar = useToggleStar();
  const addRecentlyRead = useUiStore((s) => s.addRecentlyRead);
  const retainArticle = useUiStore((s) => s.retainArticle);
  const viewMode = useUiStore((s) => s.viewMode);

  const handleToggleRead = () => {
    const markingAsRead = !article.is_read;
    setRead.mutate(
      { id: article.id, read: markingAsRead },
      {
        onSuccess: () => {
          if (markingAsRead) {
            addRecentlyRead(article.id);
            if (viewMode === "unread") retainArticle(article.id);
          }
        },
      },
    );
  };

  const handleToggleStar = () => {
    const nextStarred = !article.is_starred;
    toggleStar.mutate(
      { id: article.id, starred: nextStarred },
      {
        onSuccess: () => {
          if (!nextStarred && viewMode === "starred") retainArticle(article.id);
        },
      },
    );
  };

  const handleOpenInBrowser = () => {
    if (article.url) {
      const bg = (usePreferencesStore.getState().prefs.open_links_background ?? "false") === "true";
      openInBrowser(article.url, bg).then((result) =>
        Result.pipe(
          result,
          Result.inspectError((e) => console.error("Failed to open browser:", e)),
        ),
      );
    }
  };

  return (
    <ContextMenu.Root>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: Base UI render prop requires event handler on static element to prevent parent context menu trigger */}
      <ContextMenu.Trigger render={<div onContextMenu={(e) => e.stopPropagation()} />}>{children}</ContextMenu.Trigger>
      <ArticleContextMenuView
        toggleReadLabel={article.is_read ? "Mark as Unread" : "Mark as Read"}
        toggleStarLabel={article.is_starred ? "Unstar" : "Star"}
        openInBrowserLabel={article.url ? "Open in Browser" : undefined}
        onToggleRead={handleToggleRead}
        onToggleStar={handleToggleStar}
        onOpenInBrowser={article.url ? handleOpenInBrowser : undefined}
      />
    </ContextMenu.Root>
  );
}
