import { ContextMenu } from "@base-ui/react/context-menu";
import type { ArticleContextMenuViewProps } from "./article-menu.types";
import { contextMenuStyles } from "./context-menu-styles";

export function ArticleContextMenuView({
  toggleReadLabel,
  toggleStarLabel,
  openInBrowserLabel,
  onToggleRead,
  onToggleStar,
  onOpenInBrowser,
}: ArticleContextMenuViewProps) {
  return (
    <ContextMenu.Portal>
      <ContextMenu.Positioner>
        <ContextMenu.Popup className={contextMenuStyles.popup}>
          <ContextMenu.Item className={contextMenuStyles.item} onClick={onToggleRead}>
            {toggleReadLabel}
          </ContextMenu.Item>
          <ContextMenu.Item className={contextMenuStyles.item} onClick={onToggleStar}>
            {toggleStarLabel}
          </ContextMenu.Item>
          {onOpenInBrowser && openInBrowserLabel && (
            <>
              <ContextMenu.Separator className={contextMenuStyles.separator} />
              <ContextMenu.Item className={contextMenuStyles.item} onClick={onOpenInBrowser}>
                {openInBrowserLabel}
              </ContextMenu.Item>
            </>
          )}
        </ContextMenu.Popup>
      </ContextMenu.Positioner>
    </ContextMenu.Portal>
  );
}
