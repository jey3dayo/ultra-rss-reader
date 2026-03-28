import { ContextMenu } from "@base-ui/react/context-menu";
import { Result } from "@praha/byethrow";
import type { ArticleDto } from "@/api/tauri-commands";
import { openInBrowser } from "@/api/tauri-commands";
import { useSetRead, useToggleStar } from "@/hooks/use-articles";
import { useUiStore } from "@/stores/ui-store";
import { contextMenuStyles } from "./context-menu-styles";

export function ArticleContextMenu({ article, children }: { article: ArticleDto; children: React.ReactNode }) {
  const setRead = useSetRead();
  const toggleStar = useToggleStar();
  const addRecentlyRead = useUiStore((s) => s.addRecentlyRead);

  const handleToggleRead = () => {
    const markingAsRead = !article.is_read;
    setRead.mutate(
      { id: article.id, read: markingAsRead },
      {
        onSuccess: () => {
          if (markingAsRead) addRecentlyRead(article.id);
        },
      },
    );
  };

  const handleToggleStar = () => {
    toggleStar.mutate({ id: article.id, starred: !article.is_starred });
  };

  const handleOpenInBrowser = () => {
    if (article.url) {
      openInBrowser(article.url).then((result) =>
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
      <ContextMenu.Portal>
        <ContextMenu.Positioner>
          <ContextMenu.Popup className={contextMenuStyles.popup}>
            <ContextMenu.Item className={contextMenuStyles.item} onClick={handleToggleRead}>
              {article.is_read ? "Mark as Unread" : "Mark as Read"}
            </ContextMenu.Item>
            <ContextMenu.Item className={contextMenuStyles.item} onClick={handleToggleStar}>
              {article.is_starred ? "Unstar" : "Star"}
            </ContextMenu.Item>
            {article.url && (
              <>
                <ContextMenu.Separator className={contextMenuStyles.separator} />
                <ContextMenu.Item className={contextMenuStyles.item} onClick={handleOpenInBrowser}>
                  Open in Browser
                </ContextMenu.Item>
              </>
            )}
          </ContextMenu.Popup>
        </ContextMenu.Positioner>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}
