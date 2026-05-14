import { ContextMenu } from "@base-ui/react/context-menu";
import type { KeyboardEvent, RefObject } from "react";
import { ArticleContextMenu } from "./article-context-menu";
import type { ArticleGroupsViewGroup } from "./article-groups-view";
import type { ArticleListEmptyStateVariant } from "./article-list-screen-view";
import { ArticleListScreenView } from "./article-list-screen-view";
import { contextMenuStyles } from "./context-menu-styles";

export type ArticleListBodyProps = {
  listAriaLabel: string;
  listRef: RefObject<HTMLDivElement | null>;
  viewportRef: RefObject<HTMLDivElement | null>;
  onListKeyDownCapture: (event: KeyboardEvent<HTMLDivElement>) => void;
  isLoading: boolean;
  loadingMessage: string;
  emptyStateVariant?: ArticleListEmptyStateVariant;
  emptyMessage: string;
  emptyDescription?: string;
  emptyActionLabel?: string;
  onEmptyAction?: () => void;
  groups: ArticleGroupsViewGroup[];
  dimArchived: string;
  textPreview: string;
  imagePreviews: string;
  selectionStyle: string;
  onSelectArticle: (articleId: string) => void;
  feedUrlById: ReadonlyMap<string, string>;
  markAllReadLabel: string;
  onMarkAllRead: () => void;
};

export function ArticleListBody({
  listAriaLabel,
  listRef,
  viewportRef,
  onListKeyDownCapture,
  isLoading,
  loadingMessage,
  emptyStateVariant,
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
  feedUrlById,
  markAllReadLabel,
  onMarkAllRead,
}: ArticleListBodyProps) {
  const hasArticles = groups.some((group) => group.items.length > 0);
  const showBodyContextMenu = !isLoading && hasArticles;

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
          emptyStateVariant={emptyStateVariant}
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
          renderRow={({ article, content }) => (
            <ArticleContextMenu article={article} feedUrl={feedUrlById.get(article.feed_id)}>
              {content}
            </ArticleContextMenu>
          )}
        />
      </ContextMenu.Trigger>
      {showBodyContextMenu ? (
        <ContextMenu.Portal>
          <ContextMenu.Positioner>
            <ContextMenu.Popup className={contextMenuStyles.popup}>
              <ContextMenu.Item className={contextMenuStyles.item} onClick={onMarkAllRead}>
                {markAllReadLabel}
              </ContextMenu.Item>
            </ContextMenu.Popup>
          </ContextMenu.Positioner>
        </ContextMenu.Portal>
      ) : null}
    </ContextMenu.Root>
  );
}
