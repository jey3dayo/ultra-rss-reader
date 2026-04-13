import { ContextMenu } from "@base-ui/react/context-menu";
import { ArticleContextMenu } from "./article-context-menu";
import type { ArticleListBodyProps } from "./article-list.types";
import { ArticleListScreenView } from "./article-list-screen-view";
import { contextMenuStyles } from "./context-menu-styles";

export function ArticleListBody({
  listAriaLabel,
  listRef,
  viewportRef,
  onListKeyDownCapture,
  isLoading,
  loadingMessage,
  emptyMessage,
  emptyDescription,
  emptyActionLabel,
  onEmptyAction,
  groups,
  dimArchived,
  textPreview,
  imagePreviews,
  selectionStyle,
  onSelectArticle,
  markAllReadLabel,
  onMarkAllRead,
}: ArticleListBodyProps) {
  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger render={<div />} className="flex-1 overflow-hidden">
        <ArticleListScreenView
          listAriaLabel={listAriaLabel}
          listRef={listRef}
          viewportRef={viewportRef}
          onListKeyDownCapture={onListKeyDownCapture}
          isLoading={isLoading}
          loadingMessage={loadingMessage}
          emptyMessage={emptyMessage}
          emptyDescription={emptyDescription}
          emptyActionLabel={emptyActionLabel}
          onEmptyAction={onEmptyAction}
          groups={groups}
          dimArchived={dimArchived}
          textPreview={textPreview}
          imagePreviews={imagePreviews}
          selectionStyle={selectionStyle}
          onSelectArticle={onSelectArticle}
          renderRow={({ article, content }) => <ArticleContextMenu article={article}>{content}</ArticleContextMenu>}
        />
      </ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Positioner>
          <ContextMenu.Popup className={contextMenuStyles.popup}>
            <ContextMenu.Item className={contextMenuStyles.item} onClick={onMarkAllRead}>
              {markAllReadLabel}
            </ContextMenu.Item>
          </ContextMenu.Popup>
        </ContextMenu.Positioner>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}
